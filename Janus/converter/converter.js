const spawn = require("child_process").spawn;
const _ = require("lodash");
const aigle = require("aigle");
const Aigle = aigle.Aigle;
const path = require("path");
const { Subject } = require("rxjs");

const spawnObservable = (cmd, args) => {
  const observable = new Subject();
  const writeObservable = new Subject();
  const runCommand = spawn(cmd, args, { shell: true });
  runCommand.on("close", (code) => {
    observable.complete({ code });
  });
  writeObservable.subscribe({
    next: (data) => {
      runCommand.stdin.write(data);
    },
  });
  runCommand.stdout.on("data", (data) => {
    observable.next(data.toString());
  });
  runCommand.on("error", (err) => {
    observable.error(err);
  });
  return { events: observable.asObservable(), sender: writeObservable };
};

const convertMjrFilesToAudioFile = async (targetDirectoryPath, ...mjrFiles) => {
  const wavFilesToProcess = {};
  let gotError = false;

  await Aigle.each(mjrFiles, async (filePath) => {
    try {
      const fileNameWithoutExtension = _.last(
        _.split(_.first(_.split(filePath, ".mjr")), "/")
      );
      const fileNameTokens = _.split(fileNameWithoutExtension, "-");
      const [callerId, owner, type] = fileNameTokens;
      if (_.size(fileNameTokens) !== 3) {
        throw "Invalid mjr file name";
      }
      const wavFilePath = path.join(
        targetDirectoryPath,
        `${fileNameWithoutExtension}.wav`
      );
      if (!wavFilesToProcess[callerId]) {
        wavFilesToProcess[callerId] = {
          callerId,
          files: [
            {
              filePath,
              wavFilePath,
              callerId,
              fileNameWithoutExtension,
              owner,
              type,
            },
          ],
        };
      } else {
        wavFilesToProcess[callerId].files.push({
          filePath,
          wavFilePath,
          callerId,
          fileNameWithoutExtension,
          owner,
          type,
        });
      }
      await new Aigle((resolve, reject) => {
        const { events: converter } = spawnObservable(`janus-pp-rec`, [
          filePath,
          wavFilePath,
        ]);
        converter.subscribe({
          next: (data) => {
            console.info(data);
            resolve();
          },
          error: (error) => {
            reject(error);
          },
          complete: () => {
            console.info("completed");
            resolve();
          },
        });
      });
      await new Aigle((resolve, reject) => {
        const { events: remover } = spawnObservable(`rm`, [`-rf ${filePath}`]);
        remover.subscribe({
          next: (data) => {
            console.info(data);
            resolve();
          },
          error: (error) => {
            reject(error);
          },
          complete: () => {
            console.info("completed");
            resolve();
          },
        });
      });
    } catch (error) {
      console.error(error);
      gotError = true;
      return;
    }
  });
  if (!gotError) {
    try {
      await Aigle.each(wavFilesToProcess, async (wavFile) => {
        if (_.size(wavFile.files) < 2) {
          throw "Files Insufficient for conversion";
        }
        const wavFilesToken = _.join(
          _.map(wavFile.files, (wavFile) => {
            return `-i ${wavFile.wavFilePath}`;
          }),
          " "
        );
        const wavFilesRemoveToken = _.join(
          _.map(wavFile.files, (wavFile) => {
            return `${wavFile.wavFilePath}`;
          }),
          " "
        );
        const targetPath = path.join(
          targetDirectoryPath,
          wavFile.callerId + ".wav"
        );
        await new Aigle((resolve, reject) => {
          const { events: combiner } = spawnObservable("ffmpeg", [
            `-y ${wavFilesToken} -filter_complex amix=inputs=${wavFile.files.length}:duration=first:dropout_transition=${wavFile.files.length} ${targetPath}`,
          ]);
          combiner.subscribe({
            next: (data) => {
              console.info(data);
              resolve();
            },
            error: (error) => {
              reject();
            },
            complete: () => {
              console.info("completed");
              resolve();
            },
          });
        });
        await new Aigle((resolve, reject) => {
          const { events: remover } = spawnObservable(`rm`, [
            `-rf ${wavFilesRemoveToken}`,
          ]);
          remover.subscribe({
            next: (data) => {
              console.info(data);
              resolve()
            },
            error: (error) => {
              reject(error)
            },
            complete: () => {
              console.info("completed");
              resolve()
            },
          });
        });
      });
    } catch (error) {
      console.error(error);
    }
  }
};
module.exports = { convertMjrFilesToAudioFile };
