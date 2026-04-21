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


// 获取节点样式并生成微信小程序代码
async function generateWechatMiniProgramCode(node: SceneNode, conversionRate: number, enableTextVariables: boolean = false): Promise<string> {
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
      if (DEBUG_MODE) {
        console.log(`文本样式ID是数组，取第一个元素: ${rawTextStyleId[0]} (原数组: ${JSON.stringify(rawTextStyleId)})`);
      }
      return rawTextStyleId[0];
    }
    if (typeof rawTextStyleId === 'string') {
      return rawTextStyleId;
    }
    if (DEBUG_MODE) {
      console.log(`无法识别的文本样式ID类型: ${typeof rawTextStyleId}, 值:`, rawTextStyleId);
    }
    return null;
  })();

  if (DEBUG_MODE) {
    console.log('样式ID:', { fillStyleId, strokeStyleId, textStyleId, effectStyleId, gridStyleId });
  }

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
    const widthRpx = pxToRpx(node.width, conversionRate);
    styles.push(`width: ${widthRpx}rpx`);
  }

  if ('height' in node) {
    const heightRpx = pxToRpx(node.height, conversionRate);
    styles.push(`height: ${heightRpx}rpx`);
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
    const marginTop = marginTopPx !== 0 ? pxToRpx(marginTopPx, conversionRate) : 0;
    const marginRight = marginRightPx !== 0 ? pxToRpx(marginRightPx, conversionRate) : 0;
    const marginBottom = marginBottomPx !== 0 ? pxToRpx(marginBottomPx, conversionRate) : 0;
    const marginLeft = marginLeftPx !== 0 ? pxToRpx(marginLeftPx, conversionRate) : 0;

    // 直接使用 rpx 值，不生成变量
    const spacingVar = (px: number, rpx: number): string => {
      if (px === 0) return '0';
      return `${rpx}rpx`;
    };

    if (marginTop === marginRight && marginTop === marginBottom && marginTop === marginLeft) {
      // 四个方向相同，使用简写
      styles.push(`margin: ${spacingVar(marginTopPx, marginTop)}`);
    } else if (marginTop === marginBottom && marginLeft === marginRight) {
      // 上下相同，左右相同
      styles.push(`margin: ${spacingVar(marginTopPx, marginTop)} ${spacingVar(marginRightPx, marginRight)}`);
    } else {
      // 四个方向都不同
      styles.push(`margin: ${spacingVar(marginTopPx, marginTop)} ${spacingVar(marginRightPx, marginRight)} ${spacingVar(marginBottomPx, marginBottom)} ${spacingVar(marginLeftPx, marginLeft)}`);
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
    // 直接使用 rpx 值，不生成变量
    const spacingVar = (px: number, rpx: number): string => {
      if (px === 0) return '0';
      return `${rpx}rpx`;
    };

    // 处理统一的 padding
    if ('padding' in node && typeof (node as any).padding === 'number' && (node as any).padding > 0) {
      const paddingPx = (node as any).padding;
      const paddingRpx = pxToRpx(paddingPx, conversionRate);
      styles.push(`padding: ${spacingVar(paddingPx, paddingRpx)}`);
    } else {
      // 分别处理四个方向的 padding
      const paddingTopPx = 'paddingTop' in node && typeof (node as any).paddingTop === 'number' ? (node as any).paddingTop : 0;
      const paddingRightPx = 'paddingRight' in node && typeof (node as any).paddingRight === 'number' ? (node as any).paddingRight : 0;
      const paddingBottomPx = 'paddingBottom' in node && typeof (node as any).paddingBottom === 'number' ? (node as any).paddingBottom : 0;
      const paddingLeftPx = 'paddingLeft' in node && typeof (node as any).paddingLeft === 'number' ? (node as any).paddingLeft : 0;

      // 转换为rpx
      const paddingTop = paddingTopPx !== 0 ? pxToRpx(paddingTopPx, conversionRate) : 0;
      const paddingRight = paddingRightPx !== 0 ? pxToRpx(paddingRightPx, conversionRate) : 0;
      const paddingBottom = paddingBottomPx !== 0 ? pxToRpx(paddingBottomPx, conversionRate) : 0;
      const paddingLeft = paddingLeftPx !== 0 ? pxToRpx(paddingLeftPx, conversionRate) : 0;

      if (paddingTop === paddingRight && paddingTop === paddingBottom && paddingTop === paddingLeft) {
        // 四个方向相同，使用简写
        styles.push(`padding: ${spacingVar(paddingTopPx, paddingTop)}`);
      } else if (paddingTop === paddingBottom && paddingLeft === paddingRight) {
        // 上下相同，左右相同
        styles.push(`padding: ${spacingVar(paddingTopPx, paddingTop)} ${spacingVar(paddingRightPx, paddingRight)}`);
      } else {
        // 四个方向都不同
        styles.push(`padding: ${spacingVar(paddingTopPx, paddingTop)} ${spacingVar(paddingRightPx, paddingRight)} ${spacingVar(paddingBottomPx, paddingBottom)} ${spacingVar(paddingLeftPx, paddingLeft)}`);
      }
    }
  }

  // 处理圆角
  if ('cornerRadius' in node && node.cornerRadius !== undefined) {
    const cornerRadius = node.cornerRadius;

    // 检查是否是数字（统一圆角）
    if (typeof cornerRadius === 'number') {
      const borderRadiusRpx = pxToRpx(cornerRadius, conversionRate);
      styles.push(`border-radius: ${borderRadiusRpx}rpx`);
    }
    // 检查是否是圆角对象（分别设置四个角）
    else if (cornerRadius !== null && typeof cornerRadius === 'object') {
      // 安全地访问属性，使用类型断言
      const cornerRadiusObj = cornerRadius as any;
      if ('topLeft' in cornerRadiusObj && typeof cornerRadiusObj.topLeft === 'number') {
        const topLeft = pxToRpx(cornerRadiusObj.topLeft, conversionRate);
        const topRight = pxToRpx(cornerRadiusObj.topRight || 0, conversionRate);
        const bottomRight = pxToRpx(cornerRadiusObj.bottomRight || 0, conversionRate);
        const bottomLeft = pxToRpx(cornerRadiusObj.bottomLeft || 0, conversionRate);
        styles.push(`border-radius: ${topLeft}rpx ${topRight}rpx ${bottomRight}rpx ${bottomLeft}rpx`);
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

      if (DEBUG_MODE) {
        console.log(`为文本样式生成备选注释: ID="${textStyleId}" -> "文本样式 ${identifier}"`);
      }
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
          const color = await generateColorWithStyleVariable(visibleFill.color, styleId, isTextNode, enableTextVariables);
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
              const color = await generateColorWithStyleVariable(firstStop.color, styleId, isTextNode, enableTextVariables);
              styles.push(`color: ${color}`);
            }
          } else {
            // 非文本节点，生成渐变背景
            const styleId = fillStyleId;
            const gradientWithVar = await generateGradientWithStyleVariable(gradientCss, styleId, enableTextVariables);
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
        strokeColor = await generateColorWithStyleVariable(stroke.color, strokeStyleId, false, enableTextVariables);
      }
    }
  }

  // 只有当有边框宽度且有可见边框颜色时才生成边框样式
  if (hasBorderWeight && hasVisibleStroke) {
    const strokeWeight = node.strokeWeight as number;
    const borderWidthRpx = pxToRpx(strokeWeight, conversionRate);
    styles.push(`border-width: ${borderWidthRpx}rpx`);
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
      if (enableTextVariables && textStyleId) {
        value = await generateTextPropertyWithStyleVariable('font-size', fallbackValue, textStyleId);
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
      if (enableTextVariables && textStyleId) {
        value = await generateTextPropertyWithStyleVariable('font-weight', fallbackValue, textStyleId);
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
      if (enableTextVariables && textStyleId) {
        value = await generateTextPropertyWithStyleVariable('font-family', fallbackValue, textStyleId);
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
        if (enableTextVariables && textStyleId) {
          value = await generateTextPropertyWithStyleVariable('line-height', fallbackValue, textStyleId);
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
        const value = fallbackValue; // 字间距直接输出值，不生成变量
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
    styles.push(`opacity: ${node.opacity}`);
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

// 是否启用文本变量（默认关闭）
let enableTextVariables = false;

// 加载保存的设置
async function loadSettings() {
  try {
    const savedRate = await figma.clientStorage.getAsync('conversionRate');
    if (savedRate !== undefined) {
      currentConversionRate = savedRate;
    }

    const savedEnableTextVariables = await figma.clientStorage.getAsync('enableTextVariables');
    if (savedEnableTextVariables !== undefined) {
      enableTextVariables = savedEnableTextVariables;
    }
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 保存设置
async function saveSettings(rate: number, enableTextVariablesSetting: boolean) {
  try {
    await figma.clientStorage.setAsync('conversionRate', rate);
    await figma.clientStorage.setAsync('enableTextVariables', enableTextVariablesSetting);
    currentConversionRate = rate;
    enableTextVariables = enableTextVariablesSetting;
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
          msg.enableTextVariables !== undefined ? msg.enableTextVariables : false
        );
        if (success) {
          figma.ui.postMessage({
            type: 'settingsSaved',
            conversionRate: msg.conversionRate,
            enableTextVariables: msg.enableTextVariables
          });
        }
      } else if (msg.type === 'loadSettings') {
        await loadSettings();
        figma.ui.postMessage({
          type: 'settingsLoaded',
          conversionRate: currentConversionRate,
          enableTextVariables: enableTextVariables
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

  // 使用当前转换倍率和文本变量设置
  const code = await generateWechatMiniProgramCode(node, currentConversionRate, enableTextVariables);

  return [
    {
      language: 'CSS',
      code: code,
      title: '微信小程序样式 (WXSS)',
    },
  ];
});
