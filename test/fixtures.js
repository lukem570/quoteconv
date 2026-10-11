/**
 * Synthetic quote export, same shape as the real one. Committed on purpose:
 * sample/ and docs/ are gitignored (real customer data), so the suites must
 * not depend on them or CI fails on a fresh clone.
 */
export const EXPORT_CSV = [
  'Type,Quote No,Date Time,Name,Email,Company,Status,Total,Comment',
  ',Product No,Product Name,SKU,Qty,Price,Quote Price,,',
  'Quote,RR Books Quote FC29,7/7/2026 22:35,teacher 1,t1@example.edu,Pine School,Draft,96,',
  'Product,1,The Ketchup King and Mr. Mustard Man - Level H/14,1KKMM,1,5.75,5.75,,',
  'Product,2,A Little Crab in Big Trouble - Level H/14,1ALCI,1,5.75,5.75,,',
  'Product,3,Oxford Sale Pack,OXSALE,1,25.5,25.5,,',
  'Quote,RR Books Quote FC30,7/22/2026 10:07,teacher 2,t2@example.edu,Oak School,Draft,336,',
  'Product,1,What Bird Am I - Level D/7,6WBAI,2,32,32,,',
  'Product,2,Play with Me - Level D/8,6PWM,2,32,32,,',
  'Quote,RR Books Quote FC31,7/24/2026 9:36,teacher 3,t3@example.edu,Elm School,Draft,175.88,',
  'Product,1,The Most Beautiful Tree - Level I/16,6TMBT,1,33.5,33.5,,',
  'Product,2,"The Fox, the Goat, and the Well - Level G/13",6TFGW,1,33.5,33.5,,',
  'Product,3,The Boy Who Cried Nurse - Level H/13,6TBWCN,1,33.5,33.5,,',
  'Product,4,Red-eyed Tree Frogs - Level H/13,6RETF,1,33.5,33.5,,',
  'Quote,RR Books Quote FC54,9/24/2026 9:23,secretary,sec@example.edu,Birch School,Draft,804.04,',
  'Product,1,The Cars Set,CARS10-SET,1,53.25,53.25,,',
].join('\n');

/** FC numbers in EXPORT_CSV, in file order. */
export const FC_NUMBERS = [29, 30, 31, 54];

/** Line-item counts per FC number, in file order. */
export const PRODUCT_COUNTS = { 29: 3, 30: 2, 31: 4, 54: 1 };
