import { describe, it } from 'mocha';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import fc from 'fast-check';
import * as Version from '../../../main/ts/core/Version';
import * as PromiseUtils from '../../../main/ts/utils/PromiseUtils';

type Arbitrary<A> = fc.Arbitrary<A>;
type MajorMinorVersion = Version.MajorMinorVersion;

const assert = chai.use(chaiAsPromised).assert;

const mmThrowMessage = 'Could not parse major.minor version string';

const smallNat = () => fc.nat(200);

const smallNatString = () => smallNat().map(String);

describe('Version', () => {
  describe('parseVersion', () => {
    it('parses a correct 3-point version', async () => {
      await fc.assert(fc.asyncProperty(smallNat(), smallNat(), smallNat(), async (major, minor, patch) => {
        const input = `${major}.${minor}.${patch}`;
        const expected = { major, minor, patch, preRelease: undefined, buildMetaData: undefined };
        await assert.becomes(Version.parseVersion(input), expected);
      }));
    });

    it('fails on 2-point versions', async () => {
      await fc.assert(fc.asyncProperty(smallNat(), smallNat(), async (major, minor) => {
        const input = `${major}.${minor}`;
        await assert.isRejected(Version.parseVersion(input), 'Could not parse version string');
      }));
    });

    it('parses a correct 3-point version with preRelease', async () => {
      await fc.assert(fc.asyncProperty(smallNat(), smallNat(), smallNat(), smallNat(), async (major, minor, patch, preRelease) => {
        const input = `${major}.${minor}.${patch}-${preRelease}`;
        const expected = { major, minor, patch, preRelease: String(preRelease), buildMetaData: undefined };
        await assert.becomes(Version.parseVersion(input), expected);
      }));
    });

    it('parses a correct 3-point version with buildmeta', async () => {
      await fc.assert(fc.asyncProperty(smallNat(), smallNat(), smallNat(), fc.integer(1, 100), async (major, minor, patch, buildMetaData) => {
        const input = `${major}.${minor}.${patch}+${buildMetaData}`;
        const actual = Version.parseVersion(input);
        const expected = { major, minor, patch, preRelease: undefined, buildMetaData: String(buildMetaData) };
        await assert.becomes(actual, expected);
      }));
    });
  });

  const invalid2Points = [
    '1.2.3',
    'cat.3',
    '',
    'dog',
    'dog.frog',
    '-1.0'
  ];

  describe('parseMajorMinorVersion', () => {
    it('parses 2-point version', async () => {
      await fc.assert(fc.asyncProperty(smallNat(), smallNat(), async (major, minor) => {
        await assert.becomes(Version.parseMajorMinorVersion(`${major}.${minor}`), { major, minor });
      }));
    });

    it('fails for invalid input (manual cases)', async () => {
      for (const x of invalid2Points) {
        await assert.isRejected(Version.parseMajorMinorVersion(x), mmThrowMessage);
      }
    });
  });

  describe('majorMinorVersionToString', () => {
    it('round-trips', async () => {
      await fc.assert(fc.asyncProperty(smallNat(), smallNat(), async (major, minor) => {
        const s = `${major}.${minor}`;
        const v = await Version.parseMajorMinorVersion(s);
        assert.deepEqual(Version.majorMinorVersionToString(v), s);
      }));
    });
  });

  describe('versionToString', () => {
    it('round-trips for 3-point version', async () => {
      await fc.assert(fc.asyncProperty(smallNat(), smallNat(), smallNat(), async (major, minor, patch) => {
        const sVersion = `${major}.${minor}.${patch}`;
        const version = await Version.parseVersion(sVersion);
        const actual = Version.versionToString(version);
        assert.deepEqual(actual, sVersion);
      }));
    });

    it('round-trips for version with prerelease', async () => {
      await fc.assert(fc.asyncProperty(smallNat(), smallNat(), smallNat(), smallNatString(),
        async (major, minor, patch, preRelease) => {
          const input = `${major}.${minor}.${patch}-${preRelease}`;
          const version = await Version.parseVersion(input);
          const actual = Version.versionToString(version);
          assert.deepEqual(actual, input);
        }
      ));
    });

    it('round-trips for version with buildmeta', async () => {
      await fc.assert(fc.asyncProperty(smallNat(), smallNat(), smallNat(), smallNatString(),
        async (major, minor, patch, buildMetaData) => {
          const input = `${major}.${minor}.${patch}+${buildMetaData}`;
          const version = await Version.parseVersion(input);
          const actual = Version.versionToString(version);
          assert.deepEqual(actual, input);
        }
      ));
    });
  });

  describe('sortMajorMinorVersions', () => {
    const arbmm = (): Arbitrary<MajorMinorVersion> => fc.tuple(fc.nat(300), fc.nat(300)).map(([ major, minor ]) => ({ major, minor }));

    it('returns the same length array', () => {
      fc.assert(fc.property(fc.array(arbmm()), (mms) => {
        assert.equal(
          Version.sortMajorMinorVersions(mms).length,
          mms.length
        );
      }));
    });

    it('sorts', async () => {
      const check = async (sInput: string[], sExpected: string[]): Promise<void> => {
        const mmInput = await PromiseUtils.parMap(sInput, Version.parseMajorMinorVersion);
        const mmOutput = Version.sortMajorMinorVersions(mmInput);
        const sOutput = mmOutput.map(Version.majorMinorVersionToString);
        assert.deepEqual(sOutput, sExpected);
      };
      await check([], []);
      await check([ '3.4' ], [ '3.4' ]);
      await check([ '1.0', '2.0' ], [ '1.0', '2.0' ]);
      await check([ '2.0', '1.0' ], [ '1.0', '2.0' ]);
      await check([ '1.100', '1.10' ], [ '1.10', '1.100' ]);
      await check([ '1.2', '1.10' ], [ '1.2', '1.10' ]);
      await check([ '1.10', '1.0' ], [ '1.0', '1.10' ]);
    });
  });
});
