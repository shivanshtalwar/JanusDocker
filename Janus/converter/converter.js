const spawn = require("child_process").spawn;
const _ = require("lodash");
var ffmpeg = require("fluent-ffmpeg");
const aigle = require("aigle");
const Aigle = aigle.Aigle;
const path = require("path");
const { Subject } = require("rxjs");
const fs = require("fs");
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
      fs.rmSync(filePath, { force: true, recursive: true });
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
        const targetPath = path.join(
          targetDirectoryPath,
          wavFile.callerId + ".wav"
        );
        const command = ffmpeg();
        _.each(wavFile.files, (wavFile) => {
          command.addInput(wavFile.wavFilePath);
        });
        command
          .complexFilter([
            {
              filter: 'amix',
              inputs: wavFile.files.length,
              options: ['duration=first','dropout_transition=0']
            },
          ])
          .addOutput(targetPath,{end:true})
          .on("error", (err) => {
            console.log("An error occurred: " + err);
          })
          .on("end", function () {
            console.log("Processing finished !");
            _.each(wavFile.files,(file)=>{
              fs.rmSync(file.wavFilePath,{force:true,recursive:true})
            })
          })
          .run();
      });
    } catch (error) {
      console.error(error);
    }
  }
};
module.exports = { convertMjrFilesToAudioFile };
