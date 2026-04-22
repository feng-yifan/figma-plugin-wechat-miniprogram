// This plugin will generate a sample codegen plugin
// that appears in the Element tab of the Inspect panel.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// 调试模式标志
const DEBUG_MODE = true;

// 样式缓存（用于 dynamic-page 模式）
const styleCache = new Map<string, string>();

// 单位转换函数：将px转换为rpx
function pxToRpx(value: number, conversionRate: number): number {
  return value * conversionRate;
}

// 将Figma样式名转换为英文变量名
function figmaStyleNameToEnglishVariable(styleName: string): string {
  if (DEBUG_MODE) {
    console.log(`开始转换样式名: "${styleName}"`);
  }

  let name = styleName.trim();

  if (DEBUG_MODE) {
    console.log(`初始名称: "${name}"`);
  }

  // 将层级分隔符'/'转换为'-'
  name = name.replace(/\//g, '-');

  // 将非字母数字字符转换为连字符
  name = name.replace(/[^a-zA-Z0-9-]/g, '-');

  // 移除多余的连字符
  name = name.replace(/-+/g, '-');
  name = name.replace(/^-|-$/g, '');

  // 转换为小写
  name = name.toLowerCase();

  if (DEBUG_MODE) {
    console.log(`最终变量名: "${name}"`);
  }

  return '--' + name;
}


// 根据样式ID获取样式名（异步，兼容 dynamic-page 模式）
async function getStyleName(styleId: string): Promise<string | null> {
  if (!styleId) {
    if (DEBUG_MODE) {
      console.log('样式ID为空');
    }
    return null;
  }

  // 首先检查缓存
  if (styleCache.has(styleId)) {
    const cachedName = styleCache.get(styleId)!;
    if (DEBUG_MODE) {
      console.log(`从缓存获取样式: "${cachedName}" (ID: ${styleId})`);
    }
    return cachedName;
  }

  if (DEBUG_MODE) {
    console.log(`样式ID "${styleId}" 不在缓存中，尝试异步获取样式名...`);
  }

  try {
    // 使用异步API获取样式（兼容 dynamic-page 模式）
    const style = await figma.getStyleByIdAsync(styleId);
    if (style && style.name) {
      const styleName = style.name;
      // 缓存样式名
      styleCache.set(styleId, styleName);
      if (DEBUG_MODE) {
        console.log(`异步获取样式成功: "${styleName}" (ID: ${styleId})`);
      }
      return styleName;
    } else {
      if (DEBUG_MODE) {
        console.log(`样式ID "${styleId}" 对应的样式不存在或没有名称`);
      }
      // 缓存空值以避免重复请求
      styleCache.set(styleId, '');
      return null;
    }
  } catch (error) {
    if (DEBUG_MODE) {
      console.error(`异步获取样式名失败 (ID: ${styleId}):`, error);
    }
    // 缓存空值以避免重复失败请求
    styleCache.set(styleId, '');
    return null;
  }
}

// 生成带有样式变量的颜色值（异步，兼容 dynamic-page 模式）
async function generateColorWithStyleVariable(color: { r: number; g: number; b: number; a?: number }, styleId?: string, isTextNode: boolean = false, enableVariables: boolean = true): Promise<string> {
  const colorString = colorToCss(color);

  if (styleId && enableVariables) {
    const styleName = await getStyleName(styleId);
    let variableName: string | null = null;

    if (styleName) {
      // 首选：使用样式名转换的变量名
      variableName = figmaStyleNameToEnglishVariable(styleName);
      if (variableName) {
        if (DEBUG_MODE) {
          console.log(`样式转换（通过样式名）: "${styleName}" -> "${variableName}"`);
          console.log(`生成: var(${variableName}, ${colorString})`);
        }
        return `var(${variableName}, ${colorString})`;
      } else if (DEBUG_MODE) {
        console.log(`样式名转换失败: "${styleName}"`);
      }
    }

    // 备选：使用样式ID生成变量名，根据是否文本节点决定类型
    if (!variableName) {
      const styleType = isTextNode ? 'text' : 'color';
      variableName = styleIdToVariableName(styleId, styleType);
      if (variableName) {
        if (DEBUG_MODE) {
          console.log(`样式转换（通过样式ID）: "${styleId}" -> "${variableName}" (类型: ${styleType})`);
          console.log(`生成备选变量: var(${variableName}, ${colorString})`);
        }
        return `var(${variableName}, ${colorString})`;
      }
    }

    if (DEBUG_MODE) {
      console.log(`样式ID "${styleId}" 对应的样式名未找到，且无法生成备选变量名`);
    }
  } else if (DEBUG_MODE && styleId && !enableVariables) {
    console.log(`变量功能已关闭，使用直接颜色值: ${colorString}`);
  } else if (DEBUG_MODE && !styleId) {
    console.log(`无样式ID，使用直接颜色值: ${colorString}`);
  }

  return colorString;
}

// 生成带有样式变量的渐变值（异步，兼容 dynamic-page 模式）
async function generateGradientWithStyleVariable(gradientCss: string, styleId?: string, enableVariables: boolean = true): Promise<string> {
  if (styleId && enableVariables) {
    const styleName = await getStyleName(styleId);
    let variableName: string | null = null;

    if (styleName) {
      // 首选：使用样式名转换的变量名
      variableName = figmaStyleNameToEnglishVariable(styleName);
      if (variableName) {
        if (DEBUG_MODE) {
          console.log(`渐变样式转换（通过样式名）: "${styleName}" -> "${variableName}"`);
          console.log(`生成渐变: var(${variableName}, ${gradientCss})`);
        }
        return `var(${variableName}, ${gradientCss})`;
      } else if (DEBUG_MODE) {
        console.log(`渐变样式名转换失败: "${styleName}"`);
      }
    }

    // 备选：使用样式ID生成变量名，渐变类型
    if (!variableName) {
      variableName = styleIdToVariableName(styleId, 'gradient');
      if (variableName) {
        if (DEBUG_MODE) {
          console.log(`渐变样式转换（通过样式ID）: "${styleId}" -> "${variableName}"`);
          console.log(`生成备选渐变变量: var(${variableName}, ${gradientCss})`);
        }
        return `var(${variableName}, ${gradientCss})`;
      }
    }

    if (DEBUG_MODE) {
      console.log(`渐变样式ID "${styleId}" 对应的样式名未找到，且无法生成备选变量名`);
    }
  } else if (DEBUG_MODE && styleId && !enableVariables) {
    console.log(`变量功能已关闭，使用直接渐变值: ${gradientCss}`);
  } else if (DEBUG_MODE && !styleId) {
    console.log(`无渐变样式ID，使用直接渐变值: ${gradientCss}`);
  }

  return gradientCss;
}

// 生成带有样式变量的文本属性值（异步，兼容 dynamic-page 模式）
async function generateTextPropertyWithStyleVariable(propertyName: string, fallbackValue: string, styleId?: string): Promise<string> {
  if (styleId) {
    const styleName = await getStyleName(styleId);
    let baseVariableName: string | null = null;

    if (styleName) {
      // 首选：使用样式名转换的变量名
      baseVariableName = figmaStyleNameToEnglishVariable(styleName);
      if (baseVariableName) {
        // 为属性生成变量名，例如 --text-heading-2-font-size
        const variableName = `${baseVariableName}-${propertyName}`;
        if (DEBUG_MODE) {
          console.log(`文本属性样式转换（通过样式名）: "${styleName}" -> "${variableName}"`);
          console.log(`生成: var(${variableName}, ${fallbackValue})`);
        }
        return `var(${variableName}, ${fallbackValue})`;
      } else if (DEBUG_MODE) {
        console.log(`文本样式名转换失败: "${styleName}"`);
      }
    }

    // 备选：使用样式ID生成变量名，文本类型
    if (!baseVariableName) {
      baseVariableName = styleIdToVariableName(styleId, 'text');
      if (baseVariableName) {
        const variableName = `${baseVariableName}-${propertyName}`;
        if (DEBUG_MODE) {
          console.log(`文本属性样式转换（通过样式ID）: "${styleId}" -> "${variableName}"`);
          console.log(`生成备选变量: var(${variableName}, ${fallbackValue})`);
        }
        return `var(${variableName}, ${fallbackValue})`;
      }
    }

    if (DEBUG_MODE) {
      console.log(`文本样式ID "${styleId}" 对应的样式名未找到，且无法生成备选变量名`);
    }
  } else if (DEBUG_MODE) {
    console.log(`无文本样式ID，使用直接值: ${fallbackValue}`);
  }

  return fallbackValue;
}

// 从样式ID生成变量名（当无法获取样式名时使用）
// 从样式ID中提取标识符（数字或短哈希）
function extractStyleIdentifier(styleId: string): string {
  if (!styleId) return '';

  // 尝试从样式ID中提取数字部分（Figma样式ID格式如：S:1234,5678）
  let numericId = '';
  const matches = styleId.match(/\d+/g);
  if (matches && matches.length > 0) {
    // 取最后一个数字片段，通常是最具体的ID
    const lastMatch = matches[matches.length - 1];
    if (lastMatch.length >= 4) {
      // 取最后4-6位数字，避免过长
      numericId = lastMatch.substring(lastMatch.length - 6);
    } else {
      numericId = lastMatch;
    }
  }

  if (numericId && /^\d+$/.test(numericId)) {
    // 使用数字ID，更干净易读
    let identifier = numericId;
    // 如果数字ID以0开头，去掉前导零
    identifier = identifier.replace(/^0+/, '');
    if (identifier === '') identifier = '0';
    return identifier;
  } else {
    // 备选：生成简短、可读的哈希值（4位十六进制）
    let hash = 0;
    for (let i = 0; i < styleId.length; i++) {
      const char = styleId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(16).substring(0, 4);
  }
}

function styleIdToVariableName(styleId: string, styleType?: 'text' | 'color' | 'gradient'): string {
  if (!styleId) return '';

  const identifier = extractStyleIdentifier(styleId);

  // 根据样式类型生成不同的变量名前缀
  let prefix = 'style';
  if (styleType === 'text') {
    prefix = 'text';
  } else if (styleType === 'color') {
    prefix = 'color';
  } else if (styleType === 'gradient') {
    prefix = 'gradient';
  }

  const varName = `--${prefix}-${identifier}`;

  if (DEBUG_MODE) {
    console.log(`从样式ID生成变量名: "${styleId}" -> "${varName}" (类型: ${styleType || 'unknown'}, 标识符: ${identifier})`);
  }

  return varName;
}

// 获取属性绑定的变量名（如果存在）
async function getBoundVariableName(node: SceneNode, property: string, enableVariables: boolean): Promise<string | null> {
  const cornerRadiusProperties = ['cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'];
  if (DEBUG_MODE && cornerRadiusProperties.includes(property)) {
    console.log(`getBoundVariableName: 检查属性 "${property}", enableVariables=${enableVariables}`);
  }

  if (!enableVariables) {
    if (DEBUG_MODE && cornerRadiusProperties.includes(property)) {
      console.log(`getBoundVariableName: 变量功能已关闭，跳过属性 "${property}"`);
    }
    return null;
  }

  // 检查Figma Variables API是否可用
  if (!figma.variables || typeof figma.variables.getVariableByIdAsync !== 'function') {
    // if (DEBUG_MODE) {
    //   console.log('Figma Variables API不可用');
    // }
    return null;
  }

  try {
    // 检查boundVariables属性是否存在
    const boundVariables = (node as any).boundVariables;
    if (!boundVariables || typeof boundVariables !== 'object') {
      if (DEBUG_MODE && cornerRadiusProperties.includes(property)) {
        console.log(`节点没有boundVariables属性或不是对象`, boundVariables);
      }
      return null;
    }

    // 只对圆角属性输出详细调试信息
    if (DEBUG_MODE && cornerRadiusProperties.includes(property)) {
      console.log(`检查属性 ${property} 的变量绑定，boundVariables结构:`, boundVariables);
      console.log(`boundVariables 类型:`, typeof boundVariables);
      console.log(`boundVariables 键:`, Object.keys(boundVariables));
      // 详细打印每个键的值
      for (const key in boundVariables) {
        console.log(`boundVariables[${key}]:`, boundVariables[key]);
        console.log(`boundVariables[${key}] JSON:`, JSON.stringify(boundVariables[key]));
      }
    }

    // 检查特定属性是否绑定到变量
    const variableBinding = boundVariables[property];
    if (!variableBinding) {
      if (DEBUG_MODE && cornerRadiusProperties.includes(property)) {
        console.log(`属性 ${property} 没有变量绑定`);
      }
      return null;
    }

    // 只对圆角属性输出变量绑定结构信息
    if (DEBUG_MODE && cornerRadiusProperties.includes(property)) {
      console.log(`属性 ${property} 的变量绑定结构:`, variableBinding);
      console.log(`变量绑定结构JSON:`, JSON.stringify(variableBinding));
      console.log(`变量绑定类型:`, typeof variableBinding);
      console.log(`是数组吗?`, Array.isArray(variableBinding));
    }

    // 变量绑定可能是数组或对象，处理不同格式
    let variableId: string | undefined;

    if (Array.isArray(variableBinding)) {
      if (variableBinding.length === 0) {
        // if (DEBUG_MODE) {
        //   console.log(`变量绑定是空数组`);
        // }
        return null;
      }
      // 取第一个元素，可能包含id字段
      const firstBinding = variableBinding[0];
      // if (DEBUG_MODE) {
      //   console.log(`第一个绑定元素:`, firstBinding);
      // }
      if (firstBinding && typeof firstBinding === 'object') {
        // if (DEBUG_MODE) {
        //   console.log(`第一个绑定元素的键:`, Object.keys(firstBinding));
        //   for (const key in firstBinding) {
        //     console.log(`firstBinding.${key}:`, firstBinding[key]);
        //   }
        // }
        variableId = firstBinding.id;
        // if (DEBUG_MODE) {
        //   console.log(`从数组元素中提取的变量ID:`, variableId);
        // }
      }
    } else if (typeof variableBinding === 'object' && variableBinding !== null) {
      // 可能是直接的对象，如 { id: '...', type: 'VARIABLE_ALIAS' }
      // if (DEBUG_MODE) {
      //   console.log(`变量绑定对象的键:`, Object.keys(variableBinding));
      //   for (const key in variableBinding) {
      //     console.log(`variableBinding.${key}:`, variableBinding[key]);
      //   }
      // }
      variableId = (variableBinding as any).id;
      // if (DEBUG_MODE) {
      //   console.log(`从对象中提取的变量ID:`, variableId);
      // }
    } else {
      // if (DEBUG_MODE) {
      //   console.log(`无法识别的变量绑定类型:`, variableBinding);
      // }
      return null;
    }

    if (!variableId) {
      // if (DEBUG_MODE) {
      //   console.log(`无法从变量绑定中提取变量ID:`, variableBinding);
      // }
      return null;
    }

    // if (DEBUG_MODE) {
    //   console.log(`获取变量对象，ID: ${variableId}`);
    // }

    // 获取变量对象
    // if (DEBUG_MODE) {
    //   console.log(`正在获取变量对象，ID: "${variableId}"`);
    // }
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable) {
      // if (DEBUG_MODE) {
      //   console.log(`变量ID "${variableId}" 对应的变量不存在`);
      // }
      return null;
    }

    // if (DEBUG_MODE) {
    //   console.log(`成功获取变量对象:`, variable);
    // }

    // 获取变量名，并确保以"--"开头
    let varName = variable.name;
    if (!varName) {
      // if (DEBUG_MODE) {
      //   console.log(`变量没有名称:`, variable);
      // }
      return null;
    }

    // if (DEBUG_MODE) {
    //   console.log(`原始变量名: "${varName}"`);
    // }

    // 确保变量名以"--"开头
    if (!varName.startsWith('--')) {
      varName = '--' + varName;
      // if (DEBUG_MODE) {
      //   console.log(`添加"--"前缀: "${varName}"`);
      // }
    }

    // 将变量名中的 "/" 替换为 "-"（Figma变量名可能包含路径分隔符）
    const originalVarName = varName;
    varName = varName.replace(/\//g, '-');
    if (originalVarName !== varName) {
      // if (DEBUG_MODE) {
      //   console.log(`替换"/"为"-": "${originalVarName}" -> "${varName}"`);
      // }
    }

    if (DEBUG_MODE && cornerRadiusProperties.includes(property)) {
      console.log(`检测到变量绑定: ${property} -> ${varName} (原始名称: "${variable.name}", 变量ID: "${variableId}")`);
    }

    return varName;
  } catch (error) {
    if (DEBUG_MODE && cornerRadiusProperties.includes(property)) {
      console.error(`获取变量绑定失败 (${property}):`, error);
    }
    return null;
  }
}



// 获取节点样式并生成微信小程序代码
async function generateWechatMiniProgramCode(node: SceneNode, conversionRate: number, enableVariables: boolean = false): Promise<string> {
  const styles: string[] = [];
  let commentAdded = false; // 跟踪注释是否已添加

  // 检查是否是文本节点
  const isTextNode = 'characters' in node && typeof (node as any).characters === 'string';

  // 获取所有样式ID
  const fillStyleId = (node as any).fillStyleId;
  const strokeStyleId = (node as any).strokeStyleId;
  const rawTextStyleId = isTextNode ? (node as any).textStyleId : null;
  const effectStyleId = (node as any).effectStyleId;
  const gridStyleId = (node as any).gridStyleId;

  // 规范化文本样式ID：可能是字符串、字符串数组或null
  // 如果是数组，取第一个样式ID（通常是最具体的样式）
  const textStyleId = (() => {
    if (!rawTextStyleId) return null;
    if (Array.isArray(rawTextStyleId) && rawTextStyleId.length > 0) {
      // if (DEBUG_MODE) {
      //   console.log(`文本样式ID是数组，取第一个元素: ${rawTextStyleId[0]} (原数组: ${JSON.stringify(rawTextStyleId)})`);
      // }
      return rawTextStyleId[0];
    }
    if (typeof rawTextStyleId === 'string') {
      return rawTextStyleId;
    }
    // if (DEBUG_MODE) {
    //   console.log(`无法识别的文本样式ID类型: ${typeof rawTextStyleId}, 值:`, rawTextStyleId);
    // }
    return null;
  })();

  // if (DEBUG_MODE) {
  //   console.log('样式ID:', { fillStyleId, strokeStyleId, textStyleId, effectStyleId, gridStyleId });
  // }

  // 检查父节点是否有可见填充色（用于容器背景）
  let parentBackgroundColor = '';
  if (isTextNode && (node as any).parent) {
    const parent = (node as any).parent;
    if ('fills' in parent && Array.isArray(parent.fills) && parent.fills.length > 0) {
      const parentFill = parent.fills[0];
      // 检查父节点填充是否可见且为SOLID类型
      if (parentFill.visible !== false && parentFill.type === 'SOLID' && parentFill.color) {
        // 检查颜色是否可见（透明度 > 0.01）
        if (isColorVisible(parentFill.color)) {
          parentBackgroundColor = colorToCss(parentFill.color);
        }
      }
    }
  }

  // 处理宽度和高度
  if ('width' in node) {
    const widthPx = node.width;
    const widthRpx = pxToRpx(widthPx, conversionRate);
    const widthVar = await getBoundVariableName(node, 'width', enableVariables);
    const widthValue = widthVar
      ? `var(${widthVar}, ${widthRpx}rpx)`
      : `${widthRpx}rpx`;
    styles.push(`width: ${widthValue}`);
  }

  if ('height' in node) {
    const heightPx = node.height;
    const heightRpx = pxToRpx(heightPx, conversionRate);
    const heightVar = await getBoundVariableName(node, 'height', enableVariables);
    const heightValue = heightVar
      ? `var(${heightVar}, ${heightRpx}rpx)`
      : `${heightRpx}rpx`;
    styles.push(`height: ${heightValue}`);
  }


  // 处理外边距
  const marginProperties = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'];
  let hasMargin = false;

  for (const prop of marginProperties) {
    if (prop in node && typeof (node as any)[prop] === 'number' && (node as any)[prop] !== 0) {
      hasMargin = true;
      break;
    }
  }

  if (hasMargin) {
    // 获取原始像素值
    const marginTopPx = 'marginTop' in node && typeof (node as any).marginTop === 'number' ? (node as any).marginTop : 0;
    const marginRightPx = 'marginRight' in node && typeof (node as any).marginRight === 'number' ? (node as any).marginRight : 0;
    const marginBottomPx = 'marginBottom' in node && typeof (node as any).marginBottom === 'number' ? (node as any).marginBottom : 0;
    const marginLeftPx = 'marginLeft' in node && typeof (node as any).marginLeft === 'number' ? (node as any).marginLeft : 0;

    // 转换为rpx
    const marginTopRpx = marginTopPx !== 0 ? pxToRpx(marginTopPx, conversionRate) : 0;
    const marginRightRpx = marginRightPx !== 0 ? pxToRpx(marginRightPx, conversionRate) : 0;
    const marginBottomRpx = marginBottomPx !== 0 ? pxToRpx(marginBottomPx, conversionRate) : 0;
    const marginLeftRpx = marginLeftPx !== 0 ? pxToRpx(marginLeftPx, conversionRate) : 0;

    // 检查每个方向是否绑定到变量
    const marginTopVar = await getBoundVariableName(node, 'marginTop', enableVariables);
    const marginRightVar = await getBoundVariableName(node, 'marginRight', enableVariables);
    const marginBottomVar = await getBoundVariableName(node, 'marginBottom', enableVariables);
    const marginLeftVar = await getBoundVariableName(node, 'marginLeft', enableVariables);

    // 生成每个方向的值（带变量或rpx值）
    const generateMarginValue = (px: number, rpx: number, varName: string | null): string => {
      if (px === 0) return '0';

      if (varName) {
        return `var(${varName}, ${rpx}rpx)`;
      }

      return `${rpx}rpx`;
    };

    const marginTopValue = generateMarginValue(marginTopPx, marginTopRpx, marginTopVar);
    const marginRightValue = generateMarginValue(marginRightPx, marginRightRpx, marginRightVar);
    const marginBottomValue = generateMarginValue(marginBottomPx, marginBottomRpx, marginBottomVar);
    const marginLeftValue = generateMarginValue(marginLeftPx, marginLeftRpx, marginLeftVar);

    // 检查是否所有值相同（以简化输出）
    if (marginTopValue === marginRightValue && marginTopValue === marginBottomValue && marginTopValue === marginLeftValue) {
      // 四个方向相同，使用简写
      styles.push(`margin: ${marginTopValue}`);
    } else if (marginTopValue === marginBottomValue && marginLeftValue === marginRightValue) {
      // 上下相同，左右相同
      styles.push(`margin: ${marginTopValue} ${marginRightValue}`);
    } else {
      // 四个方向都不同
      styles.push(`margin: ${marginTopValue} ${marginRightValue} ${marginBottomValue} ${marginLeftValue}`);
    }
  }

  // 处理内边距
  const paddingProperties = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'padding'];
  let hasPadding = false;

  for (const prop of paddingProperties) {
    if (prop in node && typeof (node as any)[prop] === 'number' && (node as any)[prop] > 0) {
      hasPadding = true;
      break;
    }
  }

  if (hasPadding) {
    // 处理统一的 padding（简写属性）
    if ('padding' in node && typeof (node as any).padding === 'number' && (node as any).padding > 0) {
      const paddingPx = (node as any).padding;
      const paddingRpx = pxToRpx(paddingPx, conversionRate);
      const paddingVar = await getBoundVariableName(node, 'padding', enableVariables);

      const paddingValue = paddingVar
        ? `var(${paddingVar}, ${paddingRpx}rpx)`
        : `${paddingRpx}rpx`;

      styles.push(`padding: ${paddingValue}`);
    } else {
      // 分别处理四个方向的 padding
      const paddingTopPx = 'paddingTop' in node && typeof (node as any).paddingTop === 'number' ? (node as any).paddingTop : 0;
      const paddingRightPx = 'paddingRight' in node && typeof (node as any).paddingRight === 'number' ? (node as any).paddingRight : 0;
      const paddingBottomPx = 'paddingBottom' in node && typeof (node as any).paddingBottom === 'number' ? (node as any).paddingBottom : 0;
      const paddingLeftPx = 'paddingLeft' in node && typeof (node as any).paddingLeft === 'number' ? (node as any).paddingLeft : 0;

      // 转换为rpx
      const paddingTopRpx = paddingTopPx !== 0 ? pxToRpx(paddingTopPx, conversionRate) : 0;
      const paddingRightRpx = paddingRightPx !== 0 ? pxToRpx(paddingRightPx, conversionRate) : 0;
      const paddingBottomRpx = paddingBottomPx !== 0 ? pxToRpx(paddingBottomPx, conversionRate) : 0;
      const paddingLeftRpx = paddingLeftPx !== 0 ? pxToRpx(paddingLeftPx, conversionRate) : 0;

      // 检查每个方向是否绑定到变量
      const paddingTopVar = await getBoundVariableName(node, 'paddingTop', enableVariables);
      const paddingRightVar = await getBoundVariableName(node, 'paddingRight', enableVariables);
      const paddingBottomVar = await getBoundVariableName(node, 'paddingBottom', enableVariables);
      const paddingLeftVar = await getBoundVariableName(node, 'paddingLeft', enableVariables);

      // 生成每个方向的值（带变量或rpx值）
      const generatePaddingValue = (px: number, rpx: number, varName: string | null): string => {
        if (px === 0) return '0';

        if (varName) {
          return `var(${varName}, ${rpx}rpx)`;
        }

        return `${rpx}rpx`;
      };

      const paddingTopValue = generatePaddingValue(paddingTopPx, paddingTopRpx, paddingTopVar);
      const paddingRightValue = generatePaddingValue(paddingRightPx, paddingRightRpx, paddingRightVar);
      const paddingBottomValue = generatePaddingValue(paddingBottomPx, paddingBottomRpx, paddingBottomVar);
      const paddingLeftValue = generatePaddingValue(paddingLeftPx, paddingLeftRpx, paddingLeftVar);

      // 检查是否所有值相同（以简化输出）
      if (paddingTopValue === paddingRightValue && paddingTopValue === paddingBottomValue && paddingTopValue === paddingLeftValue) {
        // 四个方向相同，使用简写
        styles.push(`padding: ${paddingTopValue}`);
      } else if (paddingTopValue === paddingBottomValue && paddingLeftValue === paddingRightValue) {
        // 上下相同，左右相同
        styles.push(`padding: ${paddingTopValue} ${paddingRightValue}`);
      } else {
        // 四个方向都不同
        styles.push(`padding: ${paddingTopValue} ${paddingRightValue} ${paddingBottomValue} ${paddingLeftValue}`);
      }
    }
  }

  // 处理布局属性（Auto Layout）
  if ('layoutMode' in node && (node as any).layoutMode !== 'NONE') {
    const layoutMode = (node as any).layoutMode;

    // 设置 display: flex
    styles.push('display: flex');

    // 设置 flex-direction
    if (layoutMode === 'HORIZONTAL') {
      styles.push('flex-direction: row');
    } else if (layoutMode === 'VERTICAL') {
      styles.push('flex-direction: column');
    }

    // 处理主轴对齐（justify-content）
    if ('primaryAxisAlignItems' in node) {
      const alignment = (node as any).primaryAxisAlignItems;
      let justifyContent = '';

      switch (alignment) {
        case 'MIN':
          justifyContent = layoutMode === 'HORIZONTAL' ? 'flex-start' : 'flex-start';
          break;
        case 'CENTER':
          justifyContent = 'center';
          break;
        case 'MAX':
          justifyContent = layoutMode === 'HORIZONTAL' ? 'flex-end' : 'flex-end';
          break;
        case 'SPACE_BETWEEN':
          justifyContent = 'space-between';
          break;
      }

      if (justifyContent) {
        styles.push(`justify-content: ${justifyContent}`);
      }
    }

    // 处理交叉轴对齐（align-items）
    if ('counterAxisAlignItems' in node) {
      const alignment = (node as any).counterAxisAlignItems;
      let alignItems = '';

      switch (alignment) {
        case 'MIN':
          alignItems = layoutMode === 'HORIZONTAL' ? 'flex-start' : 'flex-start';
          break;
        case 'CENTER':
          alignItems = 'center';
          break;
        case 'MAX':
          alignItems = layoutMode === 'HORIZONTAL' ? 'flex-end' : 'flex-end';
          break;
        case 'BASELINE':
          alignItems = 'baseline';
          break;
      }

      if (alignItems) {
        styles.push(`align-items: ${alignItems}`);
      }
    }

    // 处理间距（gap）
    const hasItemSpacing = 'itemSpacing' in node && typeof (node as any).itemSpacing === 'number' && (node as any).itemSpacing > 0;
    const hasCounterAxisSpacing = 'counterAxisSpacing' in node && typeof (node as any).counterAxisSpacing === 'number' && (node as any).counterAxisSpacing > 0;

    if (hasItemSpacing || hasCounterAxisSpacing) {
      // 获取主轴间距
      let rowGapValue = '0';
      let columnGapValue = '0';

      if (hasItemSpacing) {
        const itemSpacingPx = (node as any).itemSpacing;
        const itemSpacingRpx = pxToRpx(itemSpacingPx, conversionRate);
        const itemSpacingVar = await getBoundVariableName(node, 'itemSpacing', enableVariables);

        rowGapValue = itemSpacingVar
          ? `var(${itemSpacingVar}, ${itemSpacingRpx}rpx)`
          : `${itemSpacingRpx}rpx`;
      }

      if (hasCounterAxisSpacing) {
        const counterAxisSpacingPx = (node as any).counterAxisSpacing;
        const counterAxisSpacingRpx = pxToRpx(counterAxisSpacingPx, conversionRate);
        const counterAxisSpacingVar = await getBoundVariableName(node, 'counterAxisSpacing', enableVariables);

        columnGapValue = counterAxisSpacingVar
          ? `var(${counterAxisSpacingVar}, ${counterAxisSpacingRpx}rpx)`
          : `${counterAxisSpacingRpx}rpx`;
      }

      // 确定gap值
      if (hasItemSpacing && hasCounterAxisSpacing) {
        // 如果两个间距都存在且不同，使用 gap: <row> <column>
        if (rowGapValue !== columnGapValue) {
          styles.push(`gap: ${rowGapValue} ${columnGapValue}`);
        } else {
          // 如果相同，使用单个值
          styles.push(`gap: ${rowGapValue}`);
        }
      } else if (hasItemSpacing) {
        // 只有主轴间距
        styles.push(`gap: ${rowGapValue}`);
      } else if (hasCounterAxisSpacing) {
        // 只有交叉轴间距
        styles.push(`gap: ${columnGapValue}`);
      }
    }
  }

  // 处理圆角 - 修复变量不生效问题
  if ('cornerRadius' in node && node.cornerRadius !== undefined) {
    const cornerRadius = node.cornerRadius;

    // 检查统一圆角变量绑定（cornerRadius属性可能绑定变量）
    const cornerRadiusVar = await getBoundVariableName(node, 'cornerRadius', enableVariables);

    // 检查是否是数字（统一圆角）
    if (typeof cornerRadius === 'number') {
      const borderRadiusRpx = pxToRpx(cornerRadius, conversionRate);

      // 对于数字类型圆角，也需要检查四个角的变量绑定
      const topLeftRadiusVar = await getBoundVariableName(node, 'topLeftRadius', enableVariables);
      const topRightRadiusVar = await getBoundVariableName(node, 'topRightRadius', enableVariables);
      const bottomRightRadiusVar = await getBoundVariableName(node, 'bottomRightRadius', enableVariables);
      const bottomLeftRadiusVar = await getBoundVariableName(node, 'bottomLeftRadius', enableVariables);

      // 关键调试信息：数字类型圆角的变量绑定检查
      if (DEBUG_MODE) {
        console.log('数字类型圆角变量绑定检查:', {
          cornerRadiusVar,
          topLeftRadiusVar,
          topRightRadiusVar,
          bottomRightRadiusVar,
          bottomLeftRadiusVar
        });
        console.log('统一圆角像素值:', cornerRadius);
        console.log('统一圆角rpx值:', borderRadiusRpx);
      }

      // 分析四个角的变量绑定情况
      const allVars = [topLeftRadiusVar, topRightRadiusVar, bottomRightRadiusVar, bottomLeftRadiusVar];
      const nonNullVars = allVars.filter(v => v);
      const uniqueVars = nonNullVars.filter((v, i, arr) => arr.indexOf(v) === i);

      // 情况1: 存在统一圆角变量（cornerRadiusVar） - 优先使用
      if (cornerRadiusVar) {
        styles.push(`border-radius: var(${cornerRadiusVar}, ${borderRadiusRpx}rpx)`);
      }
      // 情况2: 四个角都绑定了变量（任意数量）
      else if (nonNullVars.length > 0) {
        // 数字类型圆角意味着四个角值相同，使用第一个变量作为统一圆角变量
        const firstVar = nonNullVars[0];
        styles.push(`border-radius: var(${firstVar}, ${borderRadiusRpx}rpx)`);
      }
      // 情况3: 没有变量绑定
      else {
        styles.push(`border-radius: ${borderRadiusRpx}rpx`);
      }
    }
    // 检查是否是圆角对象（分别设置四个角）
    else if (cornerRadius !== null && typeof cornerRadius === 'object') {
      const cornerRadiusObj = cornerRadius as any;
      if ('topLeft' in cornerRadiusObj && typeof cornerRadiusObj.topLeft === 'number') {
        // 获取原始像素值
        const topLeftPx = cornerRadiusObj.topLeft;
        const topRightPx = cornerRadiusObj.topRight || 0;
        const bottomRightPx = cornerRadiusObj.bottomRight || 0;
        const bottomLeftPx = cornerRadiusObj.bottomLeft || 0;

        // 转换为rpx值
        const topLeftRpx = pxToRpx(topLeftPx, conversionRate);
        const topRightRpx = pxToRpx(topRightPx, conversionRate);
        const bottomRightRpx = pxToRpx(bottomRightPx, conversionRate);
        const bottomLeftRpx = pxToRpx(bottomLeftPx, conversionRate);

        // 检查四个角的单独变量绑定
        const topLeftRadiusVar = await getBoundVariableName(node, 'topLeftRadius', enableVariables);
        const topRightRadiusVar = await getBoundVariableName(node, 'topRightRadius', enableVariables);
        const bottomRightRadiusVar = await getBoundVariableName(node, 'bottomRightRadius', enableVariables);
        const bottomLeftRadiusVar = await getBoundVariableName(node, 'bottomLeftRadius', enableVariables);

        // 关键调试信息：圆角变量绑定状态
        if (DEBUG_MODE) {
          console.log('圆角变量绑定检查:', {
            cornerRadiusVar,
            topLeftRadiusVar,
            topRightRadiusVar,
            bottomRightRadiusVar,
            bottomLeftRadiusVar
          });
          console.log('四个角像素值:', {topLeftPx, topRightPx, bottomRightPx, bottomLeftPx});
          console.log('四个角rpx值:', {topLeftRpx, topRightRpx, bottomRightRpx, bottomLeftRpx});
        }

        // 检查四个角的值是否完全相同
        const allValuesSame = topLeftPx === topRightPx &&
                            topLeftPx === bottomRightPx &&
                            topLeftPx === bottomLeftPx;

        if (DEBUG_MODE) {
          console.log('四个角值是否相同:', allValuesSame);
        }

        // 分析四个角的变量绑定情况
        const allVars = [topLeftRadiusVar, topRightRadiusVar, bottomRightRadiusVar, bottomLeftRadiusVar];
        const nonNullVars = allVars.filter(v => v);
        const uniqueVars = nonNullVars.filter((v, i, arr) => arr.indexOf(v) === i);

        // 情况1: 存在统一圆角变量（cornerRadiusVar） - 优先使用
        if (cornerRadiusVar) {
          styles.push(`border-radius: var(${cornerRadiusVar}, ${topLeftRpx}rpx)`);
        }
        // 情况2: 四个角都绑定了变量（任意数量）
        else if (nonNullVars.length > 0) {
          // 如果四个角值相同，使用第一个变量作为统一圆角变量
          if (allValuesSame) {
            const firstVar = nonNullVars[0];
            styles.push(`border-radius: var(${firstVar}, ${topLeftRpx}rpx)`);
          }
          // 如果四个角都绑定了同一个变量（全部绑定且变量相同）
          else if (nonNullVars.length === 4 && uniqueVars.length === 1) {
            const commonVar = uniqueVars[0];
            styles.push(`border-radius: var(${commonVar}, ${topLeftRpx}rpx) var(${commonVar}, ${topRightRpx}rpx) var(${commonVar}, ${bottomRightRpx}rpx) var(${commonVar}, ${bottomLeftRpx}rpx)`);
          }
          // 情况3: 部分角绑定了变量，或变量不同
          else {
            // 分别生成单独属性
            if (topLeftRadiusVar) {
              styles.push(`border-top-left-radius: var(${topLeftRadiusVar}, ${topLeftRpx}rpx)`);
            } else if (topLeftPx !== 0) {
              styles.push(`border-top-left-radius: ${topLeftRpx}rpx`);
            }

            if (topRightRadiusVar) {
              styles.push(`border-top-right-radius: var(${topRightRadiusVar}, ${topRightRpx}rpx)`);
            } else if (topRightPx !== 0) {
              styles.push(`border-top-right-radius: ${topRightRpx}rpx`);
            }

            if (bottomRightRadiusVar) {
              styles.push(`border-bottom-right-radius: var(${bottomRightRadiusVar}, ${bottomRightRpx}rpx)`);
            } else if (bottomRightPx !== 0) {
              styles.push(`border-bottom-right-radius: ${bottomRightRpx}rpx`);
            }

            if (bottomLeftRadiusVar) {
              styles.push(`border-bottom-left-radius: var(${bottomLeftRadiusVar}, ${bottomLeftRpx}rpx)`);
            } else if (bottomLeftPx !== 0) {
              styles.push(`border-bottom-left-radius: ${bottomLeftRpx}rpx`);
            }
          }
        }
        // 情况4: 没有变量绑定
        else {
          if (allValuesSame) {
            styles.push(`border-radius: ${topLeftRpx}rpx`);
          } else {
            styles.push(`border-radius: ${topLeftRpx}rpx ${topRightRpx}rpx ${bottomRightRpx}rpx ${bottomLeftRpx}rpx`);
          }
        }
      }
    }
  }

  // 处理填充色
  // 首先，如果是文本节点且有父节点背景色，添加容器背景
  if (isTextNode && parentBackgroundColor) {
    styles.push(`background-color: ${parentBackgroundColor}`);
  }

  // 如果是文本节点且有文本样式，在颜色处理之前添加注释
  if (isTextNode && textStyleId && !commentAdded) {
    const textStyleName = await getStyleName(textStyleId);
    if (textStyleName) {
      styles.push(`/* ${textStyleName} */`);
      commentAdded = true;
    } else {
      // 无法获取样式名，使用与变量名相同的标识符
      const identifier = extractStyleIdentifier(textStyleId);
      styles.push(`/* 文本样式 ${identifier} */`);
      commentAdded = true;

      // if (DEBUG_MODE) {
      //   console.log(`为文本样式生成备选注释: ID="${textStyleId}" -> "文本样式 ${identifier}"`);
      // }
    }
  }

  // 然后处理节点本身的填充色
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
    // 查找第一个可见的填充
    let visibleFill = null;
    for (const fill of node.fills) {
      if (fill.visible !== false) {
        visibleFill = fill;
        break;
      }
    }

    if (visibleFill) {
      // 处理SOLID类型填充
      if (visibleFill.type === 'SOLID' && visibleFill.color) {
        // 检查颜色是否可见（透明度 > 0.01）
        if (isColorVisible(visibleFill.color)) {
          // 对于颜色样式，文本节点使用fillStyleId（颜色样式），非文本节点也使用fillStyleId
          const styleId = fillStyleId;
          const color = await generateColorWithStyleVariable(visibleFill.color, styleId, isTextNode, enableVariables);
          // 如果是文本节点，生成文本颜色；否则生成背景颜色
          if (isTextNode) {
            styles.push(`color: ${color}`);
          } else {
            styles.push(`background-color: ${color}`);
          }
        }
      }
      // 处理渐变类型填充
      else if (
        visibleFill.type === 'GRADIENT_LINEAR' ||
        visibleFill.type === 'GRADIENT_RADIAL' ||
        visibleFill.type === 'GRADIENT_ANGULAR' ||
        visibleFill.type === 'GRADIENT_DIAMOND'
      ) {
        const gradientCss = gradientToCss(visibleFill);
        if (gradientCss) {
          // 对于文本节点，如果填充是渐变，取第一个色标的颜色作为文字颜色
          if (isTextNode && visibleFill.gradientStops && visibleFill.gradientStops.length > 0) {
            const firstStop = visibleFill.gradientStops[0];
            if (firstStop.color && isColorVisible(firstStop.color)) {
              const styleId = fillStyleId;
              const color = await generateColorWithStyleVariable(firstStop.color, styleId, isTextNode, enableVariables);
              styles.push(`color: ${color}`);
            }
          } else {
            // 非文本节点，生成渐变背景
            const styleId = fillStyleId;
            const gradientWithVar = await generateGradientWithStyleVariable(gradientCss, styleId, enableVariables);
            styles.push(`background-image: ${gradientWithVar}`);
          }
        }
      }
    }
  }

  // 处理边框
  // 检查是否有边框（strokeWeight > 0，且不是figma.mixed）
  const hasBorderWeight = 'strokeWeight' in node &&
    node.strokeWeight !== figma.mixed &&
    typeof node.strokeWeight === 'number' &&
    node.strokeWeight > 0;

  // 检查是否有可见的边框颜色
  let hasVisibleStroke = false;
  let strokeColor = '';

  if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
    const stroke = node.strokes[0];
    // 检查stroke是否可见且为SOLID类型
    if (stroke.visible !== false && stroke.type === 'SOLID' && stroke.color) {
      // 检查颜色是否可见（透明度 > 0）
      if (isColorVisible(stroke.color)) {
        hasVisibleStroke = true;
        strokeColor = await generateColorWithStyleVariable(stroke.color, strokeStyleId, false, enableVariables);
      }
    }
  }

  // 只有当有边框宽度且有可见边框颜色时才生成边框样式
  if (hasBorderWeight && hasVisibleStroke) {
    const strokeWeight = node.strokeWeight as number;
    const borderWidthRpx = pxToRpx(strokeWeight, conversionRate);
    const borderWidthVar = await getBoundVariableName(node, 'strokeWeight', enableVariables);
    const borderWidthValue = borderWidthVar
      ? `var(${borderWidthVar}, ${borderWidthRpx}rpx)`
      : `${borderWidthRpx}rpx`;
    styles.push(`border-width: ${borderWidthValue}`);
    styles.push(`border-style: solid`);
    styles.push(`border-color: ${strokeColor}`);
  }

  // 处理文本样式
  let hasTextStyle = false;

  if (isTextNode) {
    // 对于文本节点，检查常见的文本样式属性
    const textStyleProperties = [
      'fontSize', 'fontWeight', 'fontFamily', 'fontName',
      'lineHeight', 'letterSpacing', 'textAlignHorizontal',
      'textAlignVertical', 'textDecoration', 'textCase'
    ];

    for (const prop of textStyleProperties) {
      const value = (node as any)[prop];
      if (value !== undefined && value !== null && value !== figma.mixed) {
        hasTextStyle = true;
        break;
      }
    }

    // 如果没有任何标准文本属性，但确实是文本节点，仍然尝试处理
    // 因为文本节点至少应该有某些样式
    if (!hasTextStyle && isTextNode) {
      hasTextStyle = true;
    }
  }

  if (hasTextStyle) {

    // 字体大小
    if ('fontSize' in node && (node as any).fontSize !== figma.mixed && typeof (node as any).fontSize === 'number' && (node as any).fontSize > 0) {
      const fontSizePx = (node as any).fontSize;
      const fontSizeRpx = pxToRpx(fontSizePx, conversionRate);
      const fallbackValue = `${fontSizeRpx}rpx`;
      let value = fallbackValue;
      if (enableVariables) {
        // 首先检查直接变量绑定
        const fontSizeVar = await getBoundVariableName(node, 'fontSize', enableVariables);
        if (fontSizeVar) {
          value = `var(${fontSizeVar}, ${fallbackValue})`;
        } else if (textStyleId) {
          // 如果没有直接变量绑定，但存在文本样式ID，使用文本样式变量
          value = await generateTextPropertyWithStyleVariable('font-size', fallbackValue, textStyleId);
        }
      }
      styles.push(`font-size: ${value}`);
    }

    // 字体粗细
    if ('fontWeight' in node && (node as any).fontWeight !== figma.mixed && typeof (node as any).fontWeight === 'number') {
      const weight = (node as any).fontWeight;
      let fontWeight = weight.toString();
      if (weight === 400) fontWeight = 'normal';
      if (weight === 700) fontWeight = 'bold';
      const fallbackValue = fontWeight;
      let value = fallbackValue;
      if (enableVariables) {
        // 首先检查直接变量绑定
        const fontWeightVar = await getBoundVariableName(node, 'fontWeight', enableVariables);
        if (fontWeightVar) {
          value = `var(${fontWeightVar}, ${fallbackValue})`;
        } else if (textStyleId) {
          // 如果没有直接变量绑定，但存在文本样式ID，使用文本样式变量
          value = await generateTextPropertyWithStyleVariable('font-weight', fallbackValue, textStyleId);
        }
      }
      styles.push(`font-weight: ${value}`);
    }

    // 字体家族
    let fontFamily = '';
    if ('fontName' in node && (node as any).fontName !== null && typeof (node as any).fontName === 'object') {
      const fontName = (node as any).fontName;
      if (fontName.family && typeof fontName.family === 'string') {
        fontFamily = fontName.family;
      }
    } else if ('fontFamily' in node && typeof (node as any).fontFamily === 'string') {
      fontFamily = (node as any).fontFamily;
    }

    if (fontFamily) {
      const fallbackValue = `"${fontFamily}"`;
      let value = fallbackValue;
      if (enableVariables) {
        // 首先检查直接变量绑定
        const fontFamilyVar = await getBoundVariableName(node, 'fontFamily', enableVariables);
        if (fontFamilyVar) {
          value = `var(${fontFamilyVar}, ${fallbackValue})`;
        } else if (textStyleId) {
          // 如果没有直接变量绑定，但存在文本样式ID，使用文本样式变量
          value = await generateTextPropertyWithStyleVariable('font-family', fallbackValue, textStyleId);
        }
      }
      styles.push(`font-family: ${value}`);
    }

    // 行高
    if ('lineHeight' in node && (node as any).lineHeight !== figma.mixed) {
      const lineHeight = (node as any).lineHeight;
      let fallbackValue = '';
      if (typeof lineHeight === 'number' && lineHeight > 0) {
        const lineHeightRpx = pxToRpx(lineHeight, conversionRate);
        fallbackValue = `${lineHeightRpx}rpx`;
      } else if (typeof lineHeight === 'object' && lineHeight !== null) {
        if (lineHeight.unit === 'PIXELS' && typeof lineHeight.value === 'number') {
          const lineHeightRpx = pxToRpx(lineHeight.value, conversionRate);
          fallbackValue = `${lineHeightRpx}rpx`;
        } else if (lineHeight.unit === 'PERCENT' && typeof lineHeight.value === 'number') {
          fallbackValue = `${lineHeight.value}%`;
        }
      }
      if (fallbackValue) {
        let value = fallbackValue;
        if (enableVariables) {
          // 首先检查直接变量绑定
          const lineHeightVar = await getBoundVariableName(node, 'lineHeight', enableVariables);
          if (lineHeightVar) {
            value = `var(${lineHeightVar}, ${fallbackValue})`;
          } else if (textStyleId) {
            // 如果没有直接变量绑定，但存在文本样式ID，使用文本样式变量
            value = await generateTextPropertyWithStyleVariable('line-height', fallbackValue, textStyleId);
          }
        }
        styles.push(`line-height: ${value}`);
      }
    }

    // 字间距
    if ('letterSpacing' in node && (node as any).letterSpacing !== figma.mixed) {
      const letterSpacing = (node as any).letterSpacing;
      let fallbackValue = '';
      if (typeof letterSpacing === 'number') {
        const letterSpacingRpx = pxToRpx(letterSpacing, conversionRate);
        fallbackValue = `${letterSpacingRpx}rpx`;
      } else if (typeof letterSpacing === 'object' && letterSpacing !== null) {
        if (letterSpacing.unit === 'PIXELS' && typeof letterSpacing.value === 'number') {
          const letterSpacingRpx = pxToRpx(letterSpacing.value, conversionRate);
          fallbackValue = `${letterSpacingRpx}rpx`;
        } else if (letterSpacing.unit === 'PERCENT' && typeof letterSpacing.value === 'number') {
          fallbackValue = `${letterSpacing.value}%`;
        }
      }
      if (fallbackValue) {
        let value = fallbackValue;
        if (enableVariables) {
          // 检查直接变量绑定
          const letterSpacingVar = await getBoundVariableName(node, 'letterSpacing', enableVariables);
          if (letterSpacingVar) {
            value = `var(${letterSpacingVar}, ${fallbackValue})`;
          } else if (textStyleId) {
            // 如果没有直接变量绑定，但存在文本样式ID，使用文本样式变量
            value = await generateTextPropertyWithStyleVariable('letter-spacing', fallbackValue, textStyleId);
          }
        }
        styles.push(`letter-spacing: ${value}`);
      }
    }

    // 文本对齐
    if ('textAlignHorizontal' in node && (node as any).textAlignHorizontal !== figma.mixed && typeof (node as any).textAlignHorizontal === 'string') {
      const align = (node as any).textAlignHorizontal.toLowerCase();
      const fallbackValue = align;
      const value = fallbackValue; // 文本对齐直接输出值，不生成变量
      styles.push(`text-align: ${value}`);
    }

    // 文本装饰
    if ('textDecoration' in node && (node as any).textDecoration !== figma.mixed && typeof (node as any).textDecoration === 'string') {
      const decoration = (node as any).textDecoration.toLowerCase();
      const fallbackValue = decoration;
      const value = fallbackValue; // 文本装饰直接输出值，不生成变量
      styles.push(`text-decoration: ${value}`);
    }

    // 文本大小写
    if ('textCase' in node && (node as any).textCase !== figma.mixed && typeof (node as any).textCase === 'string') {
      const textCase = (node as any).textCase.toLowerCase();
      let transform = '';
      if (textCase === 'upper') {
        transform = 'uppercase';
      } else if (textCase === 'lower') {
        transform = 'lowercase';
      } else if (textCase === 'title') {
        transform = 'capitalize';
      }
      if (transform) {
        const fallbackValue = transform;
        const value = fallbackValue; // 文本大小写直接输出值，不生成变量
        styles.push(`text-transform: ${value}`);
      }
    }
  }

  // 处理透明度
  if ('opacity' in node && typeof node.opacity === 'number') {
    const opacityValue = node.opacity;
    const opacityVar = await getBoundVariableName(node, 'opacity', enableVariables);
    const opacityStyle = opacityVar
      ? `var(${opacityVar}, ${opacityValue})`
      : `${opacityValue}`;
    styles.push(`opacity: ${opacityStyle}`);
  }

  // 将样式数组连接为字符串，每行一个样式
  // 注释行不加分号，属性行加分号
  const result = styles.map(style => style.startsWith('/*') ? style : style + ';').join('\n');
  return result;
}

// 将RGB颜色对象转换为十六进制颜色代码
function rgbToHex(color: { r: number; g: number; b: number }): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

// 将颜色对象转换为CSS颜色字符串（支持透明度）
function colorToCss(color: { r: number; g: number; b: number; a?: number }): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  // 微信小程序 WXSS 要求十六进制，忽略透明度（透明度由单独的 opacity 属性处理）
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

// 将Figma渐变转换为CSS渐变字符串
function gradientToCss(paint: GradientPaint): string {
  if (paint.type === 'GRADIENT_LINEAR') {
    // 线性渐变
    const stops = paint.gradientStops;
    const colorStops = stops.map(stop => {
      const color = colorToCss(stop.color);
      const position = Math.round(stop.position * 100);
      return `${color} ${position}%`;
    }).join(', ');

    // 计算渐变角度
    let angle = 'to bottom'; // 默认方向
    if (paint.gradientTransform) {
      // gradientTransform是3x3矩阵: [[a,b,c],[d,e,f]]
      const [[a, b, c], [d, e, f]] = paint.gradientTransform;
      // 计算变换后的方向向量
      const dx = a; // x方向变化
      const dy = d; // y方向变化
      // 计算角度（弧度），注意Figma坐标系y向下
      const rad = Math.atan2(dy, dx);
      // 转换为CSS角度（0deg表示向上，顺时针）
      let cssDeg = rad * 180 / Math.PI;
      // 调整角度，使0deg对应向上
      cssDeg = 90 - cssDeg;
      // 标准化到0-360度
      cssDeg = ((cssDeg % 360) + 360) % 360;
      angle = `${cssDeg.toFixed(1)}deg`;
    }

    return `linear-gradient(${angle}, ${colorStops})`;
  } else if (paint.type === 'GRADIENT_RADIAL') {
    // 径向渐变
    const stops = paint.gradientStops;
    const colorStops = stops.map(stop => {
      const color = colorToCss(stop.color);
      const position = Math.round(stop.position * 100);
      return `${color} ${position}%`;
    }).join(', ');
    return `radial-gradient(circle, ${colorStops})`;
  } else if (paint.type === 'GRADIENT_ANGULAR') {
    // 角度渐变（锥形渐变）
    const stops = paint.gradientStops;
    const colorStops = stops.map(stop => {
      const color = colorToCss(stop.color);
      const position = Math.round(stop.position * 100);
      return `${color} ${position}%`;
    }).join(', ');
    return `conic-gradient(${colorStops})`;
  } else if (paint.type === 'GRADIENT_DIAMOND') {
    // 菱形渐变（CSS不支持，使用径向渐变近似）
    const stops = paint.gradientStops;
    const colorStops = stops.map(stop => {
      const color = colorToCss(stop.color);
      const position = Math.round(stop.position * 100);
      return `${color} ${position}%`;
    }).join(', ');
    return `radial-gradient(circle at center, ${colorStops})`;
  }
  // 默认返回空字符串
  return '';
}

// 检查颜色是否可见（透明度 > 0.01，避免非常接近透明的颜色）
function isColorVisible(color: { r: number; g: number; b: number; a?: number }): boolean {
  // 如果没有alpha属性，默认可见 (a=1)
  if (color.a === undefined) return true;
  // 如果alpha大于0.01，认为可见（避免舍入误差）
  return color.a > 0.01;
}

// 默认转换倍率：1px = 2rpx
const DEFAULT_CONVERSION_RATE = 2;

// 当前转换倍率
let currentConversionRate = DEFAULT_CONVERSION_RATE;

// 是否启用变量（包括文本变量、间距变量、圆角变量等，默认关闭）
let enableVariables = false;

// 加载保存的设置
async function loadSettings() {
  try {
    const savedRate = await figma.clientStorage.getAsync('conversionRate');
    if (savedRate !== undefined) {
      currentConversionRate = savedRate;
    }

    const savedEnableVariables = await figma.clientStorage.getAsync('enableVariables');
    if (savedEnableVariables !== undefined) {
      enableVariables = savedEnableVariables;
    }
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 保存设置
async function saveSettings(rate: number, enableVariablesSetting: boolean) {
  try {
    await figma.clientStorage.setAsync('conversionRate', rate);
    await figma.clientStorage.setAsync('enableVariables', enableVariablesSetting);
    currentConversionRate = rate;
    enableVariables = enableVariablesSetting;
    return true;
  } catch (error) {
    console.error('保存设置失败:', error);
    return false;
  }
}

// 初始化加载设置
loadSettings();


// 处理插件命令
figma.on('run', ({ command }) => {
  if (command === 'show-settings') {
    // 显示设置界面
    figma.showUI(__html__, { width: 400, height: 700 });

    // 处理来自UI的消息
    figma.ui.onmessage = async (msg) => {
      if (msg.type === 'saveSettings') {
        const success = await saveSettings(
          msg.conversionRate,
          msg.enableVariables !== undefined ? msg.enableVariables : false
        );
        if (success) {
          figma.ui.postMessage({
            type: 'settingsSaved',
            conversionRate: msg.conversionRate,
            enableVariables: msg.enableVariables
          });
        }
      } else if (msg.type === 'loadSettings') {
        await loadSettings();
        figma.ui.postMessage({
          type: 'settingsLoaded',
          conversionRate: currentConversionRate,
          enableVariables: enableVariables
        });
      }
    };
  } else if (command === 'about') {
    figma.notify('微信小程序单位转换插件 v1.0 - 将Figma中的px转换为微信小程序的rpx单位');
  }
});

// This provides the callback to generate the code.
figma.codegen.on('generate', async (event) => {
  const node = event.node;

  // 使用当前转换倍率和变量设置
  const code = await generateWechatMiniProgramCode(node, currentConversionRate, enableVariables);

  return [
    {
      language: 'CSS',
      code: code,
      title: '微信小程序样式 (WXSS)',
    },
  ];
});
