/* eslint-disable import/extensions */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import {
  CHAR_LENGTH, UINT32_LENGTH,
} from './constants.js';
import { SaveDataBufferReader } from './save-data-buffer-reader.js';
import { StringCodec } from './string-codec.js';

const textDecoder = new TextDecoder('windows-1251');

const stringCodec = new StringCodec();

const dirname = process.cwd();

const savePath = process.argv[2];

if (!savePath) {
  throw new Error('savePath not set!');
}

const preparedSavePath = path.resolve(dirname, savePath);

const saveBuffer = fs.readFileSync(preparedSavePath);

let offset = 0;

const sFileInfoLength = CHAR_LENGTH * 32;
const sFileInfo = textDecoder.decode(saveBuffer.slice(0, sFileInfoLength)).replace(/\0.*$/g, '');
offset += sFileInfoLength;

const dwExtDataOffset = saveBuffer.readUInt32LE(offset);
offset += UINT32_LENGTH;

const dwExtDataSize = saveBuffer.readUInt32LE(offset);
offset += UINT32_LENGTH;

const dwMaxSize = saveBuffer.readUInt32LE(offset);
offset += UINT32_LENGTH;

const dwPackLen = saveBuffer.readUInt32LE(offset);
offset += UINT32_LENGTH;

const pCBuffer = saveBuffer.slice(offset, offset + dwPackLen);

offset += dwPackLen;

const pBuffer = zlib.inflateSync(pCBuffer);

const saveDataBufferReader = new SaveDataBufferReader(pBuffer, dwMaxSize);

const program = saveDataBufferReader.readString();

const nSCStringsNum = saveDataBufferReader.readVDword();

const nSCStrings = {};

// eslint-disable-next-line no-plusplus
for (let i = 0; i < nSCStringsNum; i++) {
  const string = saveDataBufferReader.readString();

  if (string !== null) {
    const code = stringCodec.convert(string);
    nSCStrings[code] = string;
  }
}

saveDataBufferReader.setNameCodes(nSCStrings);

const nSegments2Load = saveDataBufferReader.readVDword();

const segments2Load = [];

// eslint-disable-next-line no-plusplus
for (let i = 0; i < nSegments2Load; i++) {
  const segmentToLoad = saveDataBufferReader.readString();
  segments2Load.push(segmentToLoad);
}

const nVarNum = saveDataBufferReader.readVDword();

const variables = [];

// eslint-disable-next-line no-plusplus
for (let i = 0; i < nVarNum; i++) {
  const string = saveDataBufferReader.readString();

  if (string === null || string === '') {
    throw new Error('missing variable name');
  }

  const variable = saveDataBufferReader.readVariable(string);

  variables.push(variable);
}

/* const results = {
  sFileInfo,
  dwExtDataOffset,
  dwExtDataSize,
  dwMaxSize,
  dwPackLen,
  program,
  nSCStrings,
  segments2Load,
  variables,
}; */

const results = variables;

fs.writeFileSync(path.resolve(dirname, 'result.json'), JSON.stringify(results, '', 2));

/*
bool COMPILER::LoadState(std::fstream &fileS)
{
  uint32_t n;
  char *pString;

  delete pBuffer;
  pBuffer = nullptr;

  EXTDATA_HEADER exdh;
  fio->_ReadFile(fileS, &exdh, sizeof(exdh));

  uint32_t dwPackLen;
  fio->_ReadFile(fileS, &dwMaxSize, sizeof(dwMaxSize));
  fio->_ReadFile(fileS, &dwPackLen, sizeof(dwPackLen));
  if (dwPackLen == 0 || dwPackLen > 0x8000000 || dwMaxSize == 0 || dwMaxSize > 0x8000000)
  {
    return false;
  }
  char *pCBuffer = new char[dwPackLen];
  pBuffer = new char[dwMaxSize];
  fio->_ReadFile(fileS, pCBuffer, dwPackLen);
  uncompress((Bytef *)pBuffer, (uLongf *)&dwMaxSize, (Bytef *)pCBuffer, dwPackLen);
  delete[] pCBuffer;
  dwCurPointer = 0;

  // Release all data
  Release();

  // save specific data (name, time, etc)
  // DWORD nSDataSize = ReadVDword();
  // if(nSDataSize) ReadData(0,nSDataSize);

  // skip ext data header
  // EXTDATA_HEADER edh;
  // ReadData(&edh, sizeof(edh));

  // 1. Program Directory
  ProgramDirectory = ReadString();

  // 4. SCodec data
  const uint32_t nSCStringsNum = ReadVDword();
  for (n = 0; n < nSCStringsNum; n++)
  {
    pString = ReadString();
    if (pString)
    {
      Assert(utf8::IsValidUtf8(pString));
      SCodec.Convert(pString);
      delete[] pString;
    }
  }

  const uint32_t nSegments2Load = ReadVDword();

  // 3.  Segments names
  // 3.a Initialize internal functions
  // 3.b Load preprocess
  InitInternalFunctions();
  LoadPreprocess();

  for (n = 0; n < nSegments2Load; n++)
  {
    char *pSegmentName = ReadString();
    Assert(utf8::IsValidUtf8(pSegmentName));
    if (!BC_LoadSegment(pSegmentName))
      return false;
    delete[] pSegmentName;
  }

  // 5. Variables table, all variables created during previous step, just read value
  const uint32_t nVarNum = ReadVDword();
  for (n = 0; n < nVarNum; n++)
  {
    pString = ReadString();
    if (pString == nullptr || strcmp(pString, "") == 0)
    {
      SetError("missing variable name");
      return false;
    }
    Assert(utf8::IsValidUtf8(pString));
    ReadVariable(pString /!*,n*!/);

    delete[] pString;
  }

  // call to script function "OnLoad()"
  OnLoad();

  delete pBuffer;
  pBuffer = nullptr;

  return true;
}
*/
