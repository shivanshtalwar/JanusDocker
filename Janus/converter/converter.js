import { spawn } from "child_process";
import _ from "lodash";
import ffmpeg from "fluent-ffmpeg";
import Aigle from "aigle";
import { join } from "path";
import { Subject } from "rxjs";
import { rmSync } from "fs";
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

  await Aigle.eachSeries(mjrFiles, async (filePath) => {
    try {
      const fileNameWithoutExtension = _.last(_.split(_.first(_.split(filePath, ".mjr")), "/"));
      const fileNameTokens = _.split(fileNameWithoutExtension, "-");
      const [callerId, owner, type] = fileNameTokens;
      if (_.size(fileNameTokens) !== 3) {
        throw new Error("Invalid mjr file name");
      }
      const wavFilePath = join(targetDirectoryPath, `${fileNameWithoutExtension}.wav`);
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
      await new Promise((resolve, reject) => {
        const { events: converter } = spawnObservable(`janus-pp-rec`, [filePath, wavFilePath]);
        converter.subscribe({
          next: (data) => {
            console.info(data);
          },
          error: (error) => {
            reject(error);
          },
          complete: () => {
            console.info("completed");
            // rmSync(filePath, { force: true, recursive: true });
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
    await Aigle.eachSeries(wavFilesToProcess, async (wavFile) => {
      if (_.size(wavFile.files) < 2) {
        throw new Error("Files Insufficient for conversion");
      }
      const targetPath = join(targetDirectoryPath, `${wavFile.callerId}.wav`);
      const inputFiles = _.map(wavFile.files, ({ wavFilePath }) => {
        return wavFilePath;
      });
      console.log(targetPath);
      console.log(inputFiles);
      await downMixAudioFiles(targetPath, inputFiles);
    });
  }
};

const downMixAudioFiles = (outputFilePath, ...inputFilePaths) => {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    _.each(inputFilePaths, (path) => {
      command.addInput(path);
    });
    command
      .complexFilter([`amix=inputs=${_.size(inputFilePaths)}:duration=longest`])
      .output(outputFilePath)
      .on("error", (err) => {
        reject(err);
      })
      .on("end", function (err, stdout, stderr) {
        resolve();
      })
      .run();
  });
};
export { convertMjrFilesToAudioFile };
