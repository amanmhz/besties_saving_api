import { DateConverter } from './date-converter.util';
import NepaliDate from 'nepali-date-converter';

export class FiscalCalculator {
  /**
   * Calculates the Fiscal Year based on a BS Date string
   * Nepali Fiscal Year runs Shrawan 1 to Ashad end
   * @param bsDate Format YYYY-MM-DD
   */
  static getFiscalYear(bsDate: string): string {
    const sanitizedDate = bsDate.replaceAll('/', '-');
    const [year, month] = sanitizedDate.split('-').map(Number);
    
    // Shrawan is month 4
    if (month >= 4) {
      return `${year}/${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}/${year.toString().slice(-2)}`;
    }
  }

  /**
   * Returns the Quarter for a given BS Date
   * Q1: Shrawan (4), Bhadra (5), Ashwin (6), Kartik (7)
   * Q2: Mangsir (8), Poush (9), Magh (10)
   * Q3: Falgun (11), Chaitra (12), Baisakh (1)
   * Q4: Jestha (2), Ashad (3)
   */
  static getFiscalQuarter(bsDate: string): string {
    const sanitizedDate = bsDate.replaceAll('/', '-');
    const month = Number(sanitizedDate.split('-')[1]);
    
    if (month >= 4 && month <= 7) return 'Q1';
    if (month >= 8 && month <= 10) return 'Q2';
    if (month >= 11 || month === 1) return 'Q3';
    if (month >= 2 && month <= 3) return 'Q4';
    
    return 'UNKNOWN';
  }

  /**
   * Calculates both FY and Quarter for an AD Date
   */
  static getFiscalDataFromAd(adDate: Date): { fiscal_year: string, fiscal_quarter: string, bs_date: string } {
    const bsDate = DateConverter.adToBs(adDate);
    return {
      bs_date: bsDate,
      fiscal_year: this.getFiscalYear(bsDate),
      fiscal_quarter: this.getFiscalQuarter(bsDate)
    };
  }
}
