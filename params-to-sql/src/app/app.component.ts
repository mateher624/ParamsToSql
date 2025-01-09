import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  inputText: string = '';
  outputText: string = '';
  errorMessage: string = '';

  public translateInput(): void {
    if (!this.inputText.trim()) {
      this.outputText = '';
      this.errorMessage = '';
      return;
    }

    try {
      const test = this.parseParams(this.inputText);
      console.log(test);
      this.outputText = this.addQueryWithParameters(test);
      this.errorMessage = '';
    } catch (error: any) {
      this.outputText = '';
      this.errorMessage = error.message;
    }
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch((err) => {
      alert('Failed to copy: ' + err);
    });
  }

  private parseParams(input: string): Param[] {
    console.log(input);

    const paramss = input.split('\n');
    const paramRegexExp: RegExp = /^([0-z]*)\=([\s\S]*)$/g;
    const result: Param[] = [];

    for (const param of paramss) {
      const matches = param.matchAll(paramRegexExp);

      var match = matches.next().value;

      if (match !== undefined) {
        const value = this.getValue(match[2]);
        result.push({
          name: match[1],
          value: value.value,
          type: value.type,
        });
      }
    }

    return result;
  }

  private getValue(valueString: string): ParamValue {
    return (
      this.getValueIfInteger(valueString) ??
      this.getValueIfBoolean(valueString) ??
      this.getValueIfFloat(valueString) ??
      this.getValueIfArray(valueString) ??
      this.getValueString(valueString)
    );
  }

  private getValueIfInteger(value: string): ParamValue | null {
    const valueRegexExpInt = new RegExp('^([\\d]+)$');
    if (valueRegexExpInt.test(value)) {
      return {
        value: +value,
        type: ParamType.Integer,
      };
    }

    return null;
  }

  private getValueIfBoolean(value: string): ParamValue | null {
    const valueRegexExpInt = new RegExp('^True|False$');
    if (valueRegexExpInt.test(value)) {
      return {
        value: value === 'True',
        type: ParamType.Boolean,
      };
    }

    return null;
  }

  private getValueIfFloat(value: string): ParamValue | null {
    const valueRegexExpInt = new RegExp('^([\\d.]+)$');
    if (valueRegexExpInt.test(value)) {
      return {
        value: +value,
        type: ParamType.Float,
      };
    }

    return null;
  }

  private getValueIfArray(value: string): ParamValue | null {
    const valueRegexExpArray: RegExp = /^\( ([\S\s]*) \)(\[[\S\s]+\])$/g;
    const matches = value.matchAll(valueRegexExpArray);
    const match = matches.next().value;
    if (match != undefined) {
      console.log(match);
      return {
        value: {
          typeName: match[2],
          values: match[1].split(' '),
        },
        type: ParamType.Table,
      };
    }

    return null;
  }

  private getValueString(value: string): ParamValue {
    return {
      value: value,
      type: ParamType.String,
    };
  }

  private addQueryWithParameters(params: Param[]): string {
    const parametersModel = params;

    let queryWithParameters = '';

    queryWithParameters += `DECLARE${'\n'}`;

    let insert = '';

    const parametersList = parametersModel.map((parameter) => {
      const result = this.getDeclareParameter(parameter, insert);
      if (result.insert) {
        insert += result.insert;
      }
      return result.paramString;
    });
    const joinParam = parametersList.join(',' + '\n');

    queryWithParameters += `${joinParam}${'\n'}`;
    queryWithParameters += `${insert}${'\n'}`;
    //queryWithParameters += `${log.Query}`;

    return queryWithParameters;
  }

  private getDeclareParameter(parameter: Param, insert: string): DeclareParam {
    if (parameter.type === ParamType.Table) {
      var array = parameter.value as ValueArray;
      return {
        paramString: `@${parameter.name} ${array.typeName}`,
        insert: `${this.addInsert(parameter)}`,
      };
    }

    if (parameter.type === ParamType.String) {
      return {
        paramString: `@${parameter.name} NVARCHAR(MAX) = N'${parameter.value}'`,
      };
    }

    if (parameter.type === ParamType.Null) {
      return {
        paramString: `@${parameter.name} NVARCHAR(10) = NULL`,
      };
    }

    if (parameter.type === ParamType.Boolean) {
      return {
        paramString: `@${parameter.name} BIT = ${
          parameter.value === true ? '1' : '0'
        }`,
      };
    }

    if (parameter.type === ParamType.Integer) {
      return {
        paramString: `@${parameter.name} BIGINT = ${parameter.value}`,
      };
    }

    if (parameter.type === ParamType.Float) {
      return {
        paramString: `@${parameter.name} DECIMAL(16, 5) = ${parameter.value}`,
      };
    }

    return {
      paramString: `@${parameter.name} NVARCHAR(MAX) = N'${parameter.value}'`,
    };
  }

  private addInsert(parameter: Param): string {
    let result = '';

    const array = parameter.value as ValueArray;

    const splittedObjects = array.values;
    const matchesList: string[] = [];

    for (const item of splittedObjects) {
      if (!item) continue;

      const trimmed = item.trimStart().trimEnd();
      let param = '';

      for (const colValue of trimmed.split(',')) {
        param += colValue ? colValue : 'NULL';
        param += ',';
      }

      matchesList.push(param.slice(0, -1));
    }

    const chunked = this.chunkArray(matchesList, 1000);

    for (const chunkedList of chunked) {
      result += `INSERT INTO @${parameter.name}${'\n'}`;
      result += 'VALUES (';

      const param = chunkedList.join('), (');
      result += `${param})${'\n'}`;
    }

    return result;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunked.push(array.slice(i, i + size));
    }
    return chunked;
  }
}

// // Interfaces
// interface LogsModel {
//   Parameters: SqlParameterModel[];
//   Query: string;
//   SqlCommand?: string;
// }

// interface SqlParameterModel {
//   Name: string;
//   SqlType: string;
//   Value: string;
//   TableName?: string;
// }

interface Param {
  name: string;
  value: number | string | ValueArray | boolean;
  type: ParamType;
}

interface ParamValue {
  value: number | string | ValueArray | boolean;
  type: ParamType;
}

interface ValueArray {
  typeName: string;
  values: string[];
}

enum ParamType {
  Null,
  String,
  Integer,
  Float,
  Boolean,
  Table,
}

interface DeclareParam {
  paramString: string;
  insert?: string;
}
