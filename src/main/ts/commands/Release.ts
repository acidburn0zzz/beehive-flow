import * as O from 'fp-ts/Option';
import { ReleaseArgs } from '../args/BeehiveArgs';
import * as Version from '../core/Version';
import * as Git from '../utils/Git';
import * as BranchLogic from '../core/BranchLogic';
import * as PackageJson from '../core/PackageJson';
import {
  readPackageJsonFileInDirAndRequireVersion
} from '../core/Noisy';
import * as Inspect from '../core/Inspect';

type Version = Version.Version;
const { versionToString, majorMinorVersionToString } = Version;

export const updateVersion = (version: Version): Version => ({
  major: version.major,
  minor: version.minor,
  patch: version.patch
});

export const release = async (fc: ReleaseArgs): Promise<void> => {
  const sMajorMinor = majorMinorVersionToString(fc.majorMinorVersion);
  console.log(`${sMajorMinor}`);

  const gitUrl = await Inspect.resolveGitUrl(fc.gitUrl);

  const { dir, git } = await Git.cloneInTempFolder(gitUrl, fc.temp);

  const rbn = BranchLogic.releaseBranchName(fc.majorMinorVersion);
  await Git.checkout(git, rbn);
  const { pjFile, pj, version } = await readPackageJsonFileInDirAndRequireVersion(dir);

  await BranchLogic.checkReleaseBranchPreReleaseVersion(version, fc.majorMinorVersion, rbn, 'package.json');

  const newVersion = updateVersion(version);
  console.log(`Updating version from ${versionToString(version)} to ${versionToString(newVersion)}`);

  const newPj = PackageJson.setVersion(pj, O.some(newVersion));
  await PackageJson.writePackageJsonFile(pjFile, newPj);

  await git.add(pjFile);
  await git.commit('Branch is ready for release - setting release version');

  await Git.pushUnlessDryRun(fc, dir, git);
};
