/* eslint-disable no-bitwise */
/* eslint-disable import/prefer-default-export */

const HASH_TABLE_SIZE = 512;

export class StringCodec {
  hashTable = [];

  /*
    Looking messy, but there's nothing to do with it
    Hack unsigned long int
    https://stackoverflow.com/questions/6798111/bitwise-operations-on-32-bit-unsigned-ints
  */
  makeHashValue(string) {
    let hash = 0;
    let g = 0;

    const mask = ((0xf) << (32 - 4)) >>> 0;
    const shift = (32 - 8);

    const lowercasedString = string.toLowerCase();

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < lowercasedString.length; i++) {
      hash = ((hash << 4) + lowercasedString.charCodeAt(i)) >>> 0;
      g = (hash & mask) >>> 0;
      if (g) {
        hash ^= g >>> shift;
        hash >>>= 0;
        hash ^= g;
        hash >>>= 0;
      }
    }
    return hash;
  }

  convert(string) {
    const hash = this.makeHashValue(string);
    const tableIndex = hash & (HASH_TABLE_SIZE - 1);

    this.hashTable[tableIndex] = this.hashTable[tableIndex] || [];

    if (this.hashTable[tableIndex].indexOf(string) > -1) {
      const stringsNum = this.hashTable[tableIndex].indexOf(string);
      const stringCode = (tableIndex << 16) | (stringsNum & 0xffff);

      return stringCode;
    }

    const stringsNum = this.hashTable[tableIndex].length;
    this.hashTable[tableIndex].push(string);

    const stringCode = (tableIndex << 16) | (stringsNum & 0xffff);

    return stringCode;
  }
}

/*
uint32_t MakeHashValue(const char *ps)
{
  uint32_t hval = 0;
  while (*ps != 0)
  {
    char v = *ps++;
    if ('A' <= v && v <= 'Z')
      v += 'a' - 'A'; // case independent
    hval = (hval << 4) + (unsigned long int)v;
    uint32_t g = hval & ((unsigned long int)0xf << (32 - 4));
    if (g != 0)
    {
      hval ^= g >> (32 - 8);
      hval ^= g;
    }
  }
  return hval;
}

uint32_t Convert(const char *pString, bool &bNew)
{
  uint32_t nStringCode;
  uint32_t n;
  if (pString == nullptr)
    return 0xffffffff;
  uint32_t nHash = MakeHashValue(pString);
  uint32_t nTableIndex = nHash & (HASH_TABLE_SIZE - 1);

  HTELEMENT *pE = &HTable[nTableIndex];

  for (n = 0; n < pE->nStringsNum; n++)
  {
    if (pE->pElements[n].dwHashCode == nHash && _stricmp(pString, pE->pElements[n].pStr) == 0)
    {
      nStringCode = (nTableIndex << 16) | (n & 0xffff);
      bNew = false;
      return nStringCode;
    }
  }

  n = pE->nStringsNum;
  pE->nStringsNum++;
  pE->pElements = (HTSUBELEMENT *)realloc(pE->pElements, GetNum(pE->nStringsNum) * sizeof(HTSUBELEMENT));

  const auto len = strlen(pString) + 1;
  pE->pElements[n].pStr = new char[len];
  memcpy(pE->pElements[n].pStr, pString, len);
  pE->pElements[n].dwHashCode = nHash;

  nStringCode = (nTableIndex << 16) | (n & 0xffff);
  nStringsNum++;
  bNew = true;
  return nStringCode;
}
*/
