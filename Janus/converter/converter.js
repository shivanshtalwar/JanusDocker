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

const downMixWavFilesFromMjr = async (wavFilesToProcess, targetDirectoryPath) => {
  return Aigle.eachSeries(wavFilesToProcess, async (wavFile) => {
    if (_.size(wavFile.files) < 2) {
      throw new Error("Files Insufficient for conversion");
    }
    const targetPath = join(targetDirectoryPath, `${wavFile.callerId}.wav`);
    const inputFiles = _.map(wavFile.files, ({ wavFilePath }) => {
      return wavFilePath;
    });
    try {
      await downMixAudioFiles(targetPath, ...inputFiles);
      // _.each(wavFile.files, ({ wavFilePath, filePath }) => {
      //   rmSync(wavFilePath, { recursive: true, force: true });
      //   rmSync(filePath, { force: true, recursive: true });
      // });
    } catch (error) {
      console.error("error occurred in downMixing of wav files", error);
      throw error;
    }
  });
};

const convertMjrFilesToAudioFile = async (targetDirectoryPath, ...mjrFiles) => {
  console.log(mjrFiles);
  const wavFilesToProcess = await Aigle.transform(mjrFiles, async (wavFilesToProcess, filePath) => {
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
        files: [],
      };
    }
    const { events: converter } = spawnObservable(`janus-pp-rec`, [filePath, wavFilePath]);
    try {
      await new Promise((resolve, reject) => {
        converter.subscribe({
          error: (error) => {
            console.log("error occurred in mjr conversion", error);
            reject(error);
          },
          complete: async () => {
            resolve();
          },
        });
      });
      wavFilesToProcess[callerId].files.push({
        filePath,
        ready: true,
        wavFilePath,
        callerId,
        fileNameWithoutExtension,
        owner,
        type,
      });
    } catch (error) {
      wavFilesToProcess[callerId].files.push({
        filePath,
        ready: false,
        wavFilePath,
        callerId,
        fileNameWithoutExtension,
        owner,
        type,
      });
      throw error;
    }
  });
  return downMixWavFilesFromMjr(wavFilesToProcess, targetDirectoryPath);
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
