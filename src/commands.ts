import * as AWS from 'aws-sdk';
import * as jetpack from 'fs-jetpack';
import * as fs from 'fs';
import chalk from 'chalk';
import * as inquirer from 'inquirer';

import { snakeCase } from 'lodash';

export const commands: { [commandName: string]: (selectedRegion: string) => Promise<void> } = {
  'Dump Table to JSON': async (selectedRegion: string) => {
    const dynamoDb = new AWS.DynamoDB({ region: selectedRegion });
    console.log(chalk.cyanBright(`Retrieving tables...`));
    const dynamoDBTables = await listTablesPaged(dynamoDb);
    const selectTableAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTable',
        message: 'Please select a table to dump to JSON...',
        choices: dynamoDBTables,
      },
    ]);

    let result: AWS.DynamoDB.DocumentClient.QueryOutput = undefined;
    const dumpResults: any[] = [];
    do {
      const scanParams: AWS.DynamoDB.DocumentClient.ScanInput = {
        TableName: selectTableAnswer.selectedTable,
        ExclusiveStartKey: result ? result.LastEvaluatedKey : undefined,
      };

      result = await dynamoDb.scan(scanParams).promise();
      for (const item of result.Items || []) {
        dumpResults.push(AWS.DynamoDB.Converter.unmarshall(item));
      }
    } while (result.LastEvaluatedKey);

    console.log(chalk.cyanBright(`${dumpResults.length} Items retrieved.`));

    // Save the result set.
    const outputPath = ensureOutputPath(`./output/${snakeCase(process.env.AWS_PROFILE)}/`);
    const outputFilePath = `${outputPath}${snakeCase(selectTableAnswer.selectedTable)}_dump.json`;
    console.log(chalk.cyanBright(`Dumping table to ${outputFilePath}...`));
    await jetpack.writeAsync(outputFilePath, dumpResults);
    console.log(chalk.green(`Table dumped to JSON`));
  },
};

const listTablesPaged = async (dynamoDb: AWS.DynamoDB) => {
  let pagedResult: AWS.DynamoDB.DocumentClient.ListTablesOutput = undefined;
  let tables: string[] = [];
  do {
    pagedResult = await dynamoDb.listTables({ ExclusiveStartTableName: pagedResult ? pagedResult.LastEvaluatedTableName : undefined }).promise();
    tables = tables.concat(pagedResult.TableNames || []);
  } while (pagedResult.LastEvaluatedTableName);
  return tables;
};

function ensureOutputPath(outputPath: string): string {
  fs.mkdirSync(outputPath, { recursive: true });

  return outputPath;
}
