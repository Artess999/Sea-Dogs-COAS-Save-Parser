/* eslint-disable import/extensions */
/* eslint-disable import/prefer-default-export */
import {
  UINT8_LENGTH, UINT16_LENGTH, UINT32_LENGTH, S_TOKEN_TYPE,
} from './constants.js';

const textDecoder = new TextDecoder('windows-1251');

export class SaveDataBufferReader {
  buffer;
  maxSize;
  currentOffset = 0;
  nameCodes = {};

  constructor(buffer, maxSize) {
    this.buffer = buffer;
    this.maxSize = maxSize;
  }

  setNameCodes(nameCodes) {
    this.nameCodes = nameCodes;
  }

  readData(dataSize) {
    if (this.currentOffset + dataSize > this.maxSize) {
      throw new Error('currentOffset + dataSize > maxSize');
    }

    const data = this.buffer.slice(this.currentOffset, this.currentOffset + dataSize);
    this.currentOffset += dataSize;

    return data;
  }

  readVDword() {
    const data = this.readData(UINT8_LENGTH).readUInt8(0);

    if (data < 0xfe) {
      return data;
    }

    if (data === 0xfe) {
      return this.readData(UINT16_LENGTH).readUInt16LE(0);
    }

    return this.readData(UINT32_LENGTH).readUInt32LE(0);
  }

  readString() {
    const size = this.readVDword();

    if (size === 0) {
      return null;
    }

    return textDecoder.decode(this.readData(size)).replace(/\0.*$/g, '');
  }

  // TODO rewrite recursion
  readAttributesData(root) {
    let data;

    if (root === null) {
      data = {};

      const subClassesNum = this.readVDword();
      const nameCode = this.readVDword();
      const name = this.nameCodes[nameCode];

      const value = this.readString();

      if (!name) {
        throw new Error('Wrong NameCode!');
      }

      if (value) {
        data[name] = value;
      }

      if (subClassesNum > 0) {
        data[name] = [];
      }

      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < subClassesNum; i++) {
        const subClass = this.readAttributesData(null);
        data[name].push(subClass);
      }

      return data;
    }

    const subClassesNum = this.readVDword();
    const nameCode = this.readVDword();

    const value = this.readString();

    if (value) {
      data = value;
    }

    if (subClassesNum > 0) {
      data = [];
    }

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < subClassesNum; i++) {
      const subClass = this.readAttributesData(null);
      data.push(subClass);
    }

    return data;
  }

  readVariable(string, bDim, arrayEType) {
    let varIndex;
    let arrayIndex;
    let aVarIndex;
    let aArrayIndex;
    let aPString;

    const eType = arrayEType || this.readData(UINT32_LENGTH).readUInt32LE(0);
    const eTypeName = S_TOKEN_TYPE[eType];

    if (!S_TOKEN_TYPE[eType]) {
      throw new Error('wrong eType');
    }

    const nElementsNum = bDim ? 1 : this.readData(UINT32_LENGTH).readUInt32LE(0);

    const data = {
      type: eTypeName,
    };

    if (nElementsNum > 1) {
      data[string] = [];

      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < nElementsNum; i++) {
        const dataArrEl = this.readVariable(string, true, eType);
        data[string].push(dataArrEl);
      }

      return data;
    }

    switch (eTypeName) {
      case 'VAR_INTEGER':
        data[string] = this.readData(4).readInt32LE(0);

        break;
      case 'VAR_FLOAT':
        data[string] = this.readData(4).readFloatLE(0);

        break;
      case 'VAR_STRING':
        data[string] = this.readString();

        break;
      case 'VAR_OBJECT':
        this.readData(24);
        data[string] = this.readAttributesData();

        break;
      case 'VAR_REFERENCE':
        varIndex = this.readVDword();

        if (varIndex === 0xffffffff) { // uninitialized ref
          break;
        }

        arrayIndex = this.readVDword();

        data[string] = {
          varIndex,
          arrayIndex,
        };

        break;
      case 'VAR_AREFERENCE':
        aVarIndex = this.readVDword();

        if (aVarIndex === 0xffffffff) { // uninitialized ref
          break;
        }
        aArrayIndex = this.readVDword();
        aPString = this.readString();

        data[string] = {
          aVarIndex,
          aArrayIndex,
          aPString,
        };

        break;
      default: break;
    }

    return data;
  }
}

/* char *COMPILER::ReadString()
{
    const uint32_t n = ReadVDword();
    if (n == 0)
        return nullptr;

    char *pBuffer = new char[n];
    ReadData(pBuffer, n);
    return pBuffer;
}

uint32_t COMPILER::ReadVDword()
{
    uint8_t nbv;
    uint16_t nwv;
    uint32_t v;
    ReadData(&nbv, 1);
    if (nbv < 0xfe)
    {
        return nbv;
    }
    if (nbv == 0xfe)
    {
        ReadData(&nwv, sizeof(nwv));
        return nwv;
    }
    ReadData(&v, sizeof(uint32_t));
    return v;
}

bool COMPILER::ReadData(void *data_PTR, uint32_t data_size)
{
    if (data_PTR == nullptr)
    {
        dwCurPointer += data_size;
        return true;
    }
    if (dwCurPointer + data_size > dwMaxSize)
        return false;

    memcpy(data_PTR, &pBuffer[dwCurPointer], data_size);

    dwCurPointer += data_size;

    return true;
}

void COMPILER::ReadAttributesData(ATTRIBUTES *pRoot, ATTRIBUTES *pParent)
{
    uint32_t nSubClassesNum;
    uint32_t n;
    uint32_t nNameCode;
    // char * pName;
    char *pValue;

    if (pRoot == nullptr)
    {
        nSubClassesNum = ReadVDword();
        nNameCode = ReadVDword();

        // DTrace(SCodec.Convert(nNameCode));
        pValue = ReadString();
        pParent->SetAttribute(nNameCode, pValue);
        pRoot = pParent->GetAttributeClassByCode(nNameCode);
        delete[] pValue;
        for (n = 0; n < nSubClassesNum; n++)
        {
            ReadAttributesData(nullptr, pRoot);
        }

        return;
    }

    nSubClassesNum = ReadVDword();
    nNameCode = ReadVDword();
    pValue = ReadString();
    // pRoot->SetAttribute(nNameCode,pValue);

    pRoot->SetNameCode(nNameCode);
    pRoot->SetValue(pValue);

    for (n = 0; n < nSubClassesNum; n++)
    {
        // ReadAttributesData(pRoot->GetAttributeClass(n));
        ReadAttributesData(nullptr, pRoot);
    }

    // if(pName) delete pName;
    delete[] pValue;
}

bool COMPILER::ReadVariable(char *name)
{
    long nLongValue;
    uintptr_t ptrValue;
    float fFloatValue;
    char *pString;
    uint32_t var_index;
    uint32_t array_index;
    uint32_t nElementsNum;
    ATTRIBUTES *pA;
    S_TOKEN_TYPE eType;
    const VarInfo *real_var;
    const VarInfo *real_var_ref;
    DATA *pV;
    DATA *pVRef;
    entid_t eid;
    uint32_t var_code;
    bool bSkipVariable;

    bSkipVariable = false;
    var_code = VarTab.FindVar(name);
    if (var_code == INVALID_VAR_CODE)
    {
        SetError("Load warning - variable: '%s' not found", name);
        bSkipVariable = true;
    }
    else
    {
        real_var = VarTab.GetVarX(var_code);
        if (real_var == nullptr)
        {
            SetError("Load warning - variable: '%s' has invalid var code", name);
            bSkipVariable = true;
        }
        else
        {
            pV = real_var->value.get();
        }
    }

    // trace("Read[%d]: %s",code,vi.name);
    ReadData(&eType, sizeof(eType));
    Assert(eType < S_TOKEN_TYPE::TOKEN_TYPES_COUNT);
    if (!bSkipVariable)
        if (real_var->type != eType)
        {
            SetError("load type mismatch");
            return false;
        }
    ReadData(&nElementsNum, sizeof(nElementsNum));
    if (!bSkipVariable)
        if (real_var->elements != nElementsNum)
        {
            // ???
            // SetError("load size mismatch");
            // return false;
            real_var->value->SetElementsNum(nElementsNum);
            if (!VarTab.SetElementsNum(var_code, nElementsNum))
            {
                core.Trace("Unable to set elements num for %s", real_var->name.c_str());
            }
        }

    if (nElementsNum > 1) // array
    {
        // load array elements
        for (uint32_t n = 0; n < nElementsNum; n++)
        {
            if (!ReadVariable(name, /!*code,*!/ true, n))
                return false;
        }
        return true;
    }

    switch (eType)
    {
        case VAR_INTEGER:
            ReadData(&nLongValue, sizeof(nLongValue));
            if (bSkipVariable)
                break;
            pV->Set(nLongValue);
            break;
        case VAR_PTR:
            ReadData(&ptrValue, sizeof(ptrValue));
            if (bSkipVariable)
                break;
            pV->SetPtr(ptrValue);
            break;
        case VAR_FLOAT:
            ReadData(&fFloatValue, sizeof(fFloatValue));
            if (bSkipVariable)
                break;
            pV->Set(fFloatValue);
            break;
        case VAR_STRING:
            pString = ReadString();
            if (pString)
            {
                if (!bSkipVariable)
                    pV->Set(pString);
                delete[] pString;
            }
            break;
        case VAR_OBJECT:
            ReadData(&eid, sizeof(eid));
            if (!bSkipVariable)
            {
                pV->Set(eid);

                if (pV->AttributesClass == nullptr)
                    pV->AttributesClass = new ATTRIBUTES(&SCodec);
                ReadAttributesData(pV->AttributesClass, nullptr);
            }
            else
            {
                ATTRIBUTES *pTA = new ATTRIBUTES(&SCodec);
                ReadAttributesData(pTA, nullptr);
                delete pTA;
            }
            break;
        case VAR_REFERENCE:
            var_index = ReadVDword();
            if (var_index == 0xffffffff)
                break; // uninitialized ref
            array_index = ReadVDword();
            if (bSkipVariable)
                break;
            real_var_ref = VarTab.GetVarX(var_index);
            if (real_var_ref == nullptr)
            {
                SetError("State read error");
                return false;
            }

            pVRef = real_var_ref->value.get();
            if (array_index != 0xffffffff)
            {
                pVRef = pVRef->GetArrayElement(array_index);
            }
            pV->SetReference(pVRef);
            break;
        case VAR_AREFERENCE:
            pA = nullptr;
            var_index = ReadVDword();
            if (var_index == 0xffffffff)
                break;
            array_index = ReadVDword();
            pString = ReadString();
            if (bSkipVariable)
            {
                delete pString;
                break;
            }

            real_var_ref = VarTab.GetVarX(var_index);
            if (real_var_ref == nullptr)
            {
                delete[] pString;
                SetError("State read error");
                return false;
            }

            pVRef = real_var_ref->value.get();
            if (array_index != 0xffffffff)
            {
                pVRef = pVRef->GetArrayElement(array_index);
            }

            if (pVRef->AttributesClass == nullptr)
                pVRef->AttributesClass = new ATTRIBUTES(&SCodec);
            if (pString)
            {
                pA = pVRef->AttributesClass->CreateSubAClass(pVRef->AttributesClass, pString);
                delete[] pString;
            }
            pV->SetAReference(pA);

            break;
        default:
            SetError("Unknown token type: %i", eType);
    }

    return true;
} */
