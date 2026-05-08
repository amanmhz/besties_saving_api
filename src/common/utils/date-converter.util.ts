import NepaliDate from 'nepali-date-converter';

export class DateConverter {
  /**
   * Converts Bikram Sambat (BS) date string to Gregorian (AD) Date object
   * @param bsDate String in format YYYY-MM-DD (e.g. 2081-04-15)
   * @returns Date object in AD
   */
  static bsToAd(bsDate: string): Date {
    bsDate = bsDate.replaceAll("/", "-");
    console.log("bsDate", bsDate);
    const [year, month, day] = bsDate.split('-').map(Number);
    // nepali-date-converter uses 0-indexed month (0 = Baisakh, 11 = Chaitra)
    const nd = new NepaliDate(year, month - 1, day);
    return nd.toJsDate();
  }

  /**
   * Converts Gregorian (AD) Date object to Bikram Sambat (BS) string
   * @param adDate Date object
   * @returns String in format YYYY-MM-DD
   */
  static adToBs(adDate: Date): string {
    const nd = new NepaliDate(adDate);
    const year = nd.getYear();
    const month = String(nd.getMonth() + 1).padStart(2, '0');
    const day = String(nd.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
