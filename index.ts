import * as AWS from 'aws-sdk';
import chalk from 'chalk';
import { isFunction } from 'lodash';
import * as inquirer from 'inquirer';

import { commands } from './src/commands';

const run = async () => {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedRegion',
      message: 'Please select a region...',
      choices: ['us-east-1'], //TODO: Either get the region from the current profile, or, list out all regions.
    },
  ]);

  console.log(chalk.cyanBright(`Current Settings:`));
  console.log(chalk.yellow(`\tAWS Profile: ${process.env.AWS_PROFILE}`));

  const sts = new AWS.STS();
  const result = await sts.getCallerIdentity().promise();
  console.log(chalk.cyanBright(`Get Caller Identity Response:`));
  console.dir(result);

  let commandAnswer: { selectedCommand: string };

  do {
    commandAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedCommand',
        message: 'What would you like to do?',
        choices: [...Object.keys(commands), 'Quit'],
      },
    ]);

    const command = commands[commandAnswer.selectedCommand];
    if (isFunction(command)) {
      await command(answers.selectedRegion);
    }
  } while (commandAnswer.selectedCommand !== 'Quit');
};

run()
  .then(() => {
    console.log(chalk.green('All Done!'));
  })
  .catch((reason) => {
    console.log(chalk.redBright(`An error occurred: ${reason}`));
  });
