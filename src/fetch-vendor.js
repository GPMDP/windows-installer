import { https } from 'follow-redirects';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import unzip from 'unzip';

const vendorDir = path.resolve(__dirname, '..', 'vendor');
// const VENDOR_TAG = '2.0.0';
const VENDOR_SHA = '60c0c2c47d8e262c0705e734d766218d1c4863c6';
const zipPath = path.resolve(vendorDir, `artifacts_${VENDOR_SHA}.zip`);

// let tag;
let build;
let job;

if (!fs.existsSync(vendorDir)) fs.mkdirSync(vendorDir);

const unzipArtifacts = () => {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(zipPath);
    readStream.pipe(unzip.Extract({ path: vendorDir }))
      .on('error', reject);
  });
};

if (fs.existsSync(zipPath)) {
  unzipArtifacts()
  .catch((err) => {
    console.error('An error occurred while unzipping the vendor files:', err);
    process.exit(1);
  });
} else {
  console.log('Fetching tags from GitHub');
  // fetch('https://api.github.com/repos/GPMDP/Squirrel.Windows/tags')
  //   .then((r) => r.json())
  //   .then((tags) => {
  //     tag = tags.find((tag) => tag.name === VENDOR_TAG);
  //     if (!tag) {
  //       console.error('Could not find tagged version:', VENDOR_TAG);
  //       process.exit(1);
  //     }
  //     console.log('Found tag with commit:', tag.commit.sha);
  fetch('https://ci.appveyor.com/api/projects/MarshallOfSound/squirrel-windows/history?recordsNumber=1000')
    // })
    .then((r) => r.json())
    .then((history) => {
      build = history.builds.find((build) => build.commitId === VENDOR_SHA);
      if (!build) {
        console.error('Could not find build for commit:', VENDOR_SHA);
        process.exit(1);
      }
      console.log('Found build with version:', build.version);
      return fetch(`https://ci.appveyor.com/api/projects/MarshallOfSound/squirrel-windows/build/${build.version}`);
    })
    .then((r) => r.json())
    .then((buildObj) => {
      job = buildObj.build.jobs[0];
      console.log('Found job with ID:', job.jobId);
      return new Promise((resolve, reject) => {
        console.log('Download artifacts ZIP file');
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        const outStream = fs.createWriteStream(zipPath);
        const request = https.get(`https://ci.appveyor.com/api/buildjobs/${job.jobId}/artifacts/artifacts.zip`, (response) => {
          response.pipe(outStream);
        });
        outStream.on('close', () => resolve());
        request.on('error', reject);
      });
    })
    .then(unzipArtifacts)
    .catch((err) => {
      console.error('An error occurred while fetching the vendor files:', err);
      process.exit(1);
    });
}
