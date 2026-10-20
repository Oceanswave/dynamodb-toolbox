import * as nock from 'nock';

// The CI suite uses mocked SDK calls and must never contact AWS or metadata services.
process.env.AWS_EC2_METADATA_DISABLED = 'true';
nock.disableNetConnect();
