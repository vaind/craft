import * as fs from 'fs';

import {
  getGCSCredsFromEnv,
  CraftGCSClient,
  UploadDestinationPath,
} from '../gcsApi';
import { withTempFile } from '../files';
import { CraftArtifact } from '../../artifact_providers/base';

const mockGCSUpload = jest.fn();
jest.mock('@google-cloud/storage', () => ({
  Bucket: jest.fn(() => ({ upload: mockGCSUpload })),
  Storage: jest.fn(() => ({})),
}));

describe('getGCSCredsFromEnv', () => {
  const cleanEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...cleanEnv };
  });

  it('pulls JSON creds from env', () => {
    process.env.DOG_CREDS_JSON = `{
      "project_id": "squirrel-chasing",
      "private_key": "DoGsArEgReAtSoMeSeCrEtStUfFhErE",
      "client_email": "might_huntress@dogs.com",
      "other_stuff": "can be anything",
      "tail_wagging": "true",
      "barking": "also VERY true"
    }`;

    const { project_id, client_email, private_key } = getGCSCredsFromEnv(
      { name: 'DOG_CREDS_JSON' },
      { name: 'DOG_CREDS_PATH' }
    );

    expect(project_id).toEqual('squirrel-chasing');
    expect(client_email).toEqual('might_huntress@dogs.com');
    expect(private_key).toEqual('DoGsArEgReAtSoMeSeCrEtStUfFhErE');
  });

  it('pulls filepath creds from env', async () => {
    // ensure that the assertions below actually happen, since they in an async
    // function
    expect.assertions(3);

    await withTempFile(tempFilepath => {
      fs.writeFileSync(
        tempFilepath,
        `{
          "project_id": "squirrel-chasing",
          "private_key": "DoGsArEgReAtSoMeSeCrEtStUfFhErE",
          "client_email": "might_huntress@dogs.com",
          "other_stuff": "can be anything",
          "tail_wagging": "true",
          "barking": "also VERY true"
        }`
      );
      process.env.DOG_CREDS_PATH = tempFilepath;

      const { project_id, client_email, private_key } = getGCSCredsFromEnv(
        { name: 'DOG_CREDS_JSON' },
        { name: 'DOG_CREDS_PATH' }
      );

      expect(project_id).toEqual('squirrel-chasing');
      expect(client_email).toEqual('might_huntress@dogs.com');
      expect(private_key).toEqual('DoGsArEgReAtSoMeSeCrEtStUfFhErE');
    });
  });

  it('errors if neither JSON creds nor creds filepath provided', () => {
    // skip defining variables

    expect(() => {
      getGCSCredsFromEnv(
        { name: 'DOG_CREDS_JSON' },
        { name: 'DOG_CREDS_PATH' }
      );
    }).toThrowError('GCS credentials not found!');
  });

  it('errors given bogus JSON', () => {
    process.env.DOG_CREDS_JSON = `Dogs!`;

    expect(() => {
      getGCSCredsFromEnv(
        { name: 'DOG_CREDS_JSON' },
        { name: 'DOG_CREDS_PATH' }
      );
    }).toThrowError('Error parsing JSON credentials');
  });

  it('errors if creds file missing from given path', () => {
    process.env.DOG_CREDS_PATH = './iDontExist.json';

    expect(() => {
      getGCSCredsFromEnv(
        { name: 'DOG_CREDS_JSON' },
        { name: 'DOG_CREDS_PATH' }
      );
    }).toThrowError('File does not exist: `./iDontExist.json`!');
  });

  it('errors if necessary field missing', () => {
    process.env.DOG_CREDS_JSON = `{
      "project_id": "squirrel-chasing",
      "private_key": "DoGsArEgReAtSoMeSeCrEtStUfFhErE"
    }`;

    expect(() => {
      getGCSCredsFromEnv(
        { name: 'DOG_CREDS_JSON' },
        { name: 'DOG_CREDS_PATH' }
      );
    }).toThrowError('GCS credentials missing `client_email`!');
  });
}); // end describe('getGCSCredsFromEnv')

describe('CraftGCSClient class', () => {
  const client = new CraftGCSClient({
    bucketName: 'captured-squirrels',
    credentials: {
      client_email: 'might_huntress@dogs.com',
      private_key: 'DoGsArEgReAtSoMeSeCrEtStUfFhErE',
    },
    projectId: 'squirrel-chasing',
  });

  const squirrelStatsArtifact: CraftArtifact = {
    // tslint:disable: object-literal-sort-keys
    filename: 'march-squirrel-stats.csv',
    storedFile: {
      downloadFilepath: 'squirrel-chasing/march-2020-squirrel-stats.csv',
      filename: 'march-2020-squirrel-stats.csv',
      size: 1231,
    },
    localFilepath: './temp/march-squirrel-stats.csv',
  };

  const squirrelStatsDestinationPath: UploadDestinationPath = {
    path: '/stats/2020/',
  };

  const squirrelSimulatorArtifact: CraftArtifact = {
    // tslint:disable: object-literal-sort-keys
    filename: 'bundle.js',
    storedFile: {
      downloadFilepath: 'squirrel-chasing/squirrel-simulator-bundle.js',
      filename: 'squirrel-simulator-bundle.js',
      size: 123112,
    },
    localFilepath: './temp/bundle.js',
  };

  const squirrelSimulatorDestinationPath: UploadDestinationPath = {
    path: '/simulator/v1.12.1/dist/',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    squirrelStatsDestinationPath.checked = false;
    squirrelSimulatorDestinationPath.checked = false;
  });

  it('calls the GCS library upload method with the right parameters', async () => {
    client.beforeUploadToPath(
      [squirrelStatsArtifact],
      squirrelStatsDestinationPath
    );
    await client.uploadArtifact(
      squirrelStatsArtifact,
      squirrelStatsDestinationPath
    );

    expect(mockGCSUpload).toHaveBeenCalledWith(
      './temp/march-squirrel-stats.csv',
      {
        destination: '/stats/2020/march-squirrel-stats.csv',
        gzip: true,
        metadata: { cacheControl: `public, max-age=300` },
      }
    );
  });

  it('detects content type correctly', async () => {
    client.beforeUploadToPath(
      [squirrelSimulatorArtifact],
      squirrelSimulatorDestinationPath
    );
    await client.uploadArtifact(
      squirrelSimulatorArtifact,
      squirrelSimulatorDestinationPath
    );

    expect(mockGCSUpload).toHaveBeenCalledWith(
      './temp/bundle.js',
      expect.objectContaining({
        contentType: 'application/javascript; charset=utf-8',
      })
    );
  });

  it('errors if destination path not specified', () => {
    // the entire UploadDestinationPath is undefined
    expect(() => {
      client.beforeUploadToPath([squirrelStatsArtifact], undefined as any);
    }).toThrowError('no destination path specified!');

    // the path within the UploadDestinationPath is undefined
    expect(() => {
      client.beforeUploadToPath([squirrelSimulatorArtifact], {
        path: undefined,
      } as any);
    }).toThrowError('no destination path specified!');
  });

  it('errors if local path not specified', async () => {
    const missingLocalPathArtifact = { ...squirrelStatsArtifact };
    delete missingLocalPathArtifact.localFilepath;

    client.beforeUploadToPath(
      [missingLocalPathArtifact],
      squirrelStatsDestinationPath
    );
    await expect(
      client.uploadArtifact(
        missingLocalPathArtifact,
        squirrelStatsDestinationPath
      )
    ).rejects.toThrowError('no local path to file specified!');
  });

  it('errors if GCS upload goes sideways', async () => {
    mockGCSUpload.mockImplementation(() => {
      throw new Error('whoops');
    });

    client.beforeUploadToPath(
      [squirrelSimulatorArtifact],
      squirrelSimulatorDestinationPath
    );
    await expect(
      client.uploadArtifact(
        squirrelSimulatorArtifact,
        squirrelSimulatorDestinationPath
      )
    ).rejects.toThrowError(
      'Encountered an error while uploading: Error: whoops'
    );
  });

  it("errors if beforeUploadArtifacts isn't called before uploadArtifact", async () => {
    await expect(
      client.uploadArtifact(squirrelStatsArtifact, squirrelStatsDestinationPath)
    ).rejects.toThrowError(
      'Method `beforeUploadToPath` must be called before `uploadArtifact`'
    );
  });

  it("doesn't upload anything in dry run mode", async () => {
    process.env.DRY_RUN = 'true';

    client.beforeUploadToPath(
      [squirrelSimulatorArtifact],
      squirrelSimulatorDestinationPath
    );
    await client.uploadArtifact(
      squirrelSimulatorArtifact,
      squirrelSimulatorDestinationPath
    );

    expect(mockGCSUpload).not.toHaveBeenCalled();
  });
}); // end describe('CraftGCSClient class')
