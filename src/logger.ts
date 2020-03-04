import { Severity } from '@sentry/node';
import chalk from 'chalk';
import Table = require('cli-table');
import consola = require('consola');
import { emojify } from 'node-emoji';
import { format } from 'util';

import { addBreadcrumb } from './utils/sentry';
import { getConfigFromHomeDir, getConfigFromProject } from './config';

/**
 * Prepends the message with a prefix and formats its arguments.
 *
 * The message may be any object, which will be debug formatted in that case. If
 * the message contains a format string, its placeholders will be replaced with
 * the supplied arguments. Additional arguments will be printed after that,
 * separated with spaces.
 *
 * In case the resulting formatted message contains emoji placeholders, they
 * will be replaced with the actual emoji character.
 *
 * If the message is empty, then the prefix will be omitted an an empty line
 * will be rendered instead.
 *
 * @param prefix An optional prefix prepended to the message.
 * @param message A message-like object.
 * @returns The prepared message with interpolated arguments.
 */
function formatMessage(prefix: string, message?: any, ...args: any[]): any {
  if (message === undefined && args.length === 0) {
    return '';
  }

  let formatted: string;
  if (prefix === '') {
    formatted = format(message, ...args);
  } else if (typeof message === 'string') {
    formatted = format(`${prefix} ${message}`, ...args);
  } else {
    formatted = format(prefix, message, ...args);
  }

  return emojify(formatted);
}

/**
 * Logs a debug message to the output.
 *
 * @param message A message or formattable object to log.
 * @param args Further arguments to format into the message or log after.
 */
export function debug(message?: any, ...args: any[]): void {
  console.debug(formatMessage(chalk.dim('debug'), message, ...args));
}

/**
 * Logs an info message to the output.
 *
 * @param message A message or formattable object to log.
 * @param args Further arguments to format into the message or log after.
 */
export function info(message?: any, ...args: any[]): void {
  console.info(formatMessage(chalk.blueBright('info'), message, ...args));
}

/**
 * Logs a message with default level to the output.
 *
 * @param message A message or formattable object to log.
 * @param args Further arguments to format into the message or log after.
 */
export function log(message?: any, ...args: any[]): void {
  // tslint:disable-next-line:no-console
  console.log(formatMessage('', message, ...args));
}

/**
 * Logs a warning message to the output.
 *
 * @param message A message or formattable object to log.
 * @param args Further arguments to format into the message or log after.
 */
export function warn(message?: any, ...args: any[]): void {
  console.warn(formatMessage(chalk.yellow('warning'), message, ...args));
}

/**
 * Logs an error message to the output.
 *
 * @param message A message or formattable object to log.
 * @param args Further arguments to format into the message or log after.
 */
export function error(message?: any, ...args: any[]): void {
  console.error(formatMessage(chalk.red('error'), message, ...args));
}

/**
 * Format a list as a table
 *
 * @param options Options that are passed to cli-table constructor
 * @param values A list (of lists) of values
 */
export function formatTable(options: any, values: any[]): string {
  const table = new Table(options);
  table.push(...values);
  return table.toString();
}

/***************************************************************/
/**
 * Below: we module-export "consola" instance by default.
 */

// tslint:disable:object-literal-sort-keys
export const LOG_LEVELS: { [key: string]: number } = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  SUCCESS: 3,
  DEBUG: 4,
  TRACE: 4,
};

// TODO kmclb: consola lists info as 3, not 2 - do we care?
// https://github.com/nuxt/consola/blob/HEAD/src/types.js

/** Log entry as passed to consola reporters */
interface LogEntry {
  /** Entry type */
  type: string;
  /** Creation date */
  date: string;
  /** Message */
  message: string;
  /** Additional message (e.g. if more than one line) */
  additional: string;
}

/** Reporter that sends logs to Sentry */
class SentryBreadcrumbReporter {
  /** Hook point for handling log entries */
  public log(logEntry: LogEntry): void {
    const breadcrumb = {
      message: `${logEntry.message}\n${logEntry.additional}`,
      level: logEntry.type as Severity,
    };
    addBreadcrumb(breadcrumb);
  }
}

/**
 * Reads logging level from the environment or config file, if any.
 *
 * As with other config options, environment variables beat values in a
 * project-level config file, and project level config values beat values in a
 * home directory config file.
 *
 * @returns The log level, or undefined if not configured.
 */
function getLogLevelFromConfig(): string | undefined {
  if (process.env.CRAFT_LOG_LEVEL) {
    return process.env.CRAFT_LOG_LEVEL;
  }

  const projectLevelConfig = getConfigFromProject();
  if (projectLevelConfig && projectLevelConfig.CRAFT_LOG_LEVEL) {
    return projectLevelConfig.CRAFT_LOG_LEVEL;
  }

  const homeDirConfig = getConfigFromHomeDir();
  if (homeDirConfig && homeDirConfig.CRAFT_LOG_LEVEL) {
    return homeDirConfig.CRAFT_LOG_LEVEL;
  }

  return undefined;
}

const logLevelName = getLogLevelFromConfig() || 'success';
consola.level = LOG_LEVELS[logLevelName.toUpperCase()];

consola.reporters.push(new SentryBreadcrumbReporter());

export { consola as logger };
