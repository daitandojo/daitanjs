// manipulation/src/dates.js
/**
 * @file Date manipulation utilities.
 * @module @daitanjs/manipulation/dates
 */
import { getLogger } from '@daitanjs/development';
import { DaitanInvalidInputError } from '@daitanjs/error';

const logger = getLogger('daitan-manipulation-dates');

/**
 * Converts a date string from US format (MM/DD/YYYY) to UK/European format (DD/MM/YYYY).
 * Also validates the input date string for correctness.
 *
 * @public
 * @param {string} usDate - The date string in MM/DD/YYYY format.
 * @returns {string} The date string in DD/MM/YYYY format.
 * @throws {DaitanInvalidInputError} If the input date string is not in the expected MM/DD/YYYY format or represents an invalid calendar date.
 *
 * @example
 * convertUSDateToUKDate("12/31/2023"); // "31/12/2023"
 * convertUSDateToUKDate("02/29/2024"); // "29/02/2024" (valid leap year)
 * convertUSDateToUKDate("02/29/2023"); // throws DaitanInvalidInputError
 */
export function convertUSDateToUKDate(usDate) {
  const callId = `usToUkDate-${Date.now().toString(36)}`;
  logger.debug(
    `[${callId}] convertUSDateToUKDate: Attempting to convert date "${usDate}".`
  );

  if (typeof usDate !== 'string' || !usDate.trim()) {
    const errMsg = 'Input date string cannot be empty.';
    logger.error(`[${callId}] ${errMsg}`, { input: usDate });
    throw new DaitanInvalidInputError(errMsg, { inputDate: usDate });
  }

  const parts = usDate.trim().split('/');
  if (parts.length !== 3) {
    const errMsg = `Invalid US date format: "${usDate}". Expected MM/DD/YYYY.`;
    logger.error(`[${callId}] ${errMsg}`);
    throw new DaitanInvalidInputError(errMsg, { inputDate: usDate });
  }

  const [monthStr, dayStr, yearStr] = parts;

  if (
    monthStr.length < 1 ||
    monthStr.length > 2 ||
    dayStr.length < 1 ||
    dayStr.length > 2 ||
    yearStr.length !== 4
  ) {
    const errMsg = `Invalid US date component lengths in "${usDate}". Ensure MM (1-2 digits), DD (1-2 digits), YYYY (4 digits).`;
    logger.error(`[${callId}] ${errMsg}`);
    throw new DaitanInvalidInputError(errMsg, {
      inputDate: usDate,
      parsedParts: { monthStr, dayStr, yearStr },
    });
  }

  const monthNum = parseInt(monthStr, 10);
  const dayNum = parseInt(dayStr, 10);
  const yearNum = parseInt(yearStr, 10);

  if (isNaN(monthNum) || isNaN(dayNum) || isNaN(yearNum)) {
    const errMsg = `Invalid numeric components in US date "${usDate}". Ensure MM, DD, YYYY are numbers.`;
    logger.error(`[${callId}] ${errMsg}`);
    throw new DaitanInvalidInputError(errMsg, {
      inputDate: usDate,
      parsedParts: { monthStr, dayStr, yearStr },
    });
  }

  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    const errMsg = `Month or day out of valid range in US date "${usDate}". Month: ${monthNum}, Day: ${dayNum}.`;
    logger.error(`[${callId}] ${errMsg}`);
    throw new DaitanInvalidInputError(errMsg, {
      inputDate: usDate,
      month: monthNum,
      day: dayNum,
    });
  }

  // Crucial validation: Test by creating a Date object.
  // JavaScript's Date constructor is forgiving with out-of-range days/months,
  // e.g., new Date(2023, 1, 30) becomes March 2nd, 2023.
  // So, we must check if the constructed date matches the input components.
  // Note: JavaScript months are 0-indexed (0 = January, 11 = December).
  const testDate = new Date(yearNum, monthNum - 1, dayNum);

  if (
    testDate.getFullYear() !== yearNum ||
    testDate.getMonth() !== monthNum - 1 ||
    testDate.getDate() !== dayNum
  ) {
    const errMsg = `The date "${usDate}" is not a valid calendar date (e.g., Feb 30).`;
    logger.error(`[${callId}] ${errMsg}`);
    throw new DaitanInvalidInputError(errMsg, { inputDate: usDate });
  }

  // Pad day and month with leading zero if necessary for DD/MM/YYYY format
  const ukDay = dayStr.padStart(2, '0');
  const ukMonth = monthStr.padStart(2, '0');
  const ukDate = `${ukDay}/${ukMonth}/${yearStr}`;

  logger.info(
    `[${callId}] Successfully converted "${usDate}" (US) to "${ukDate}" (UK).`
  );
  return ukDate;
}
