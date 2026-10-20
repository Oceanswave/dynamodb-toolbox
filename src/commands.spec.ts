import * as AWS from 'aws-sdk';
import * as inquirer from 'inquirer';
import * as jetpack from 'fs-jetpack';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { commands } from './commands';

jest.mock('aws-sdk', () => {
  const actual = jest.requireActual('aws-sdk');
  return { ...actual, DynamoDB: Object.assign(jest.fn(), { Converter: actual.DynamoDB.Converter }) };
});
jest.mock('inquirer', () => ({ prompt: jest.fn() }));
jest.mock('fs-jetpack', () => ({ writeAsync: jest.fn() }));

describe('Dump Table to JSON', () => {
  let cwd: string;
  let directory: string;
  let profile: string | undefined;
  let listTables: jest.Mock;
  let scan: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    cwd = process.cwd();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dynamodb-toolbox-test-'));
    process.chdir(directory);
    profile = process.env.AWS_PROFILE;
    process.env.AWS_PROFILE = 'CI profile';
    listTables = jest.fn().mockReturnValue({ promise: async () => ({ TableNames: ['Example Table'] }) });
    scan = jest.fn().mockReturnValue({ promise: async () => ({ Items: [{ id: { S: 'one' } }] }) });
    ((AWS.DynamoDB as unknown) as jest.Mock).mockImplementation(() => ({ listTables, scan }));
    ((inquirer.prompt as unknown) as jest.Mock).mockResolvedValue({ selectedTable: 'Example Table' });
    (jetpack.writeAsync as jest.Mock).mockResolvedValue(undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.chdir(cwd);
    if (profile === undefined) delete process.env.AWS_PROFILE;
    else process.env.AWS_PROFILE = profile;
    fs.rmdirSync(directory, { recursive: true });
    jest.restoreAllMocks();
  });

  it('creates nested output directories, unmarshals rows and honors the requested region', async () => {
    await commands['Dump Table to JSON']('us-east-2');
    expect(AWS.DynamoDB).toHaveBeenCalledWith({ region: 'us-east-2' });
    expect(fs.statSync(path.join(directory, 'output', 'ci_profile')).isDirectory()).toBe(true);
    expect(jetpack.writeAsync).toHaveBeenCalledWith('./output/ci_profile/example_table_dump.json', [{ id: 'one' }]);
  });

  it('passes both table-list and item-scan pagination cursors to the next request', async () => {
    listTables
      .mockReset()
      .mockReturnValueOnce({ promise: async () => ({ TableNames: ['First'], LastEvaluatedTableName: 'First' }) })
      .mockReturnValueOnce({ promise: async () => ({ TableNames: ['Example Table'] }) });
    scan
      .mockReset()
      .mockReturnValueOnce({ promise: async () => ({ Items: [{ id: { S: 'one' } }], LastEvaluatedKey: { id: { S: 'one' } } }) })
      .mockReturnValueOnce({ promise: async () => ({ Items: [{ id: { S: 'two' } }] }) });
    await commands['Dump Table to JSON']('us-east-1');
    expect(listTables).toHaveBeenNthCalledWith(2, { ExclusiveStartTableName: 'First' });
    expect(scan).toHaveBeenNthCalledWith(2, { TableName: 'Example Table', ExclusiveStartKey: { id: { S: 'one' } } });
    expect(jetpack.writeAsync).toHaveBeenCalledWith(expect.any(String), [{ id: 'one' }, { id: 'two' }]);
    expect(inquirer.prompt).toHaveBeenCalledWith([expect.objectContaining({ choices: ['First', 'Example Table'] })]);
  });

  it('handles an empty scan page and existing output directories', async () => {
    fs.mkdirSync(path.join(directory, 'output', 'ci_profile'), { recursive: true });
    scan.mockReturnValue({ promise: async () => ({}) });
    await commands['Dump Table to JSON']('us-east-1');
    expect(jetpack.writeAsync).toHaveBeenCalledWith(expect.any(String), []);
  });

  it('does not report completion before the output write finishes', async () => {
    let finishWrite: () => void = () => undefined;
    (jetpack.writeAsync as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        })
    );
    let completed = false;
    const operation = commands['Dump Table to JSON']('us-east-1').then(() => {
      completed = true;
    });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(jetpack.writeAsync).toHaveBeenCalledTimes(1);
    expect(completed).toBe(false);
    finishWrite();
    await operation;
    expect(completed).toBe(true);
  });

  it('propagates output failures to the caller', async () => {
    (jetpack.writeAsync as jest.Mock).mockRejectedValue(new Error('disk full'));
    await expect(commands['Dump Table to JSON']('us-east-1')).rejects.toThrow('disk full');
  });
});
