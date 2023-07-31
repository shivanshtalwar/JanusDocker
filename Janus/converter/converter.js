import { spawn } from "child_process";
import { last, split, first, size, each } from "lodash";
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

  await Aigle.each(mjrFiles, async (filePath) => {
    try {
      const fileNameWithoutExtension = last(split(first(split(filePath, ".mjr")), "/"));
      const fileNameTokens = split(fileNameWithoutExtension, "-");
      const [callerId, owner, type] = fileNameTokens;
      if (size(fileNameTokens) !== 3) {
        throw "Invalid mjr file name";
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
      await new Aigle((resolve, reject) => {
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
            rmSync(filePath, { force: true, recursive: true });
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
        await new Aigle((resolve, reject) => {
          if (size(wavFile.files) < 2) {
            throw "Files Insufficient for conversion";
          }
          const targetPath = join(targetDirectoryPath, wavFile.callerId + ".wav");
          const command = ffmpeg();
          each(wavFile.files, (wavFile) => {
            command.addInput(wavFile.wavFilePath);
          });
          command
            .complexFilter([
              {
                filter: "amix",
                inputs: wavFile.files.length,
                options: ["duration=first", "dropout_transition=0"],
              },
            ])
            .addOutput(targetPath, { end: true })
            .on("error", (err) => {
              console.log("An error occurred: " + err);
              reject();
            })
            .on("end", function () {
              console.log("Processing finished !");
              each(wavFile.files, (file) => {
                rmSync(file.wavFilePath, { force: true, recursive: true });
              });
              resolve();
            })
            .run();
        });
      });
    } catch (error) {
      console.error(error);
    }
  }
};
export default { convertMjrFilesToAudioFile };
