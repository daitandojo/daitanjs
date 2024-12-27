export function convertUSDateToUKDate(usDate) {
  const [month, day, year] = usDate.split('/');
  return `${day}/${month}/${year}`;
}

