// This plugin will generate a sample codegen plugin
// that appears in the Element tab of the Inspect panel.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// 调试模式标志
const DEBUG_MODE = true;

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

// 根据间距值获取CSS变量名
function getSpacingVariableName(value: number): string {
  // 常见间距值映射
  const spacingValueToName: Record<number, string> = {
    4: 'xs',
    6: 'middle',
    8: 'sm',
    12: 'md',
    16: 'lg',
    24: 'xl',
    32: 'xxl',
    48: 'xxxl',
    64: 'xxxxl'
  };

  // 四舍五入到整数
  const roundedValue = Math.round(value);
  const absoluteValue = Math.abs(roundedValue);
  const isNegative = roundedValue < 0;

  // 如果值在映射中，使用映射的名称
  let namePart: string;
  if (spacingValueToName[absoluteValue]) {
    namePart = spacingValueToName[absoluteValue];
  } else {
    // 否则使用数值作为变量名
    namePart = absoluteValue.toString();
  }

  // 添加负号前缀
  if (isNegative) {
    namePart = 'negative-' + namePart;
  }

  return `--spacing-${namePart}`;
}

// 根据样式ID获取样式名
// 根据样式ID获取样式名
function getStyleName(styleId: string): string | null {
  try {
    const style = figma.getStyleById(styleId);
    if (style) {
      if (DEBUG_MODE) {
        console.log(`获取样式成功: "${style.name}" (ID: ${styleId})`);
      }
      return style.name;
    } else {
      if (DEBUG_MODE) {
        console.log(`样式ID "${styleId}" 不存在`);
      }
    }
  } catch (error) {
    if (DEBUG_MODE) {
      console.error('获取样式名失败:', error, '样式ID:', styleId);
    }
  }
  return null;
}

// 生成带有样式变量的颜色值
function generateColorWithStyleVariable(color: { r: number; g: number; b: number; a?: number }, styleId?: string): string {
  const colorString = colorToCss(color);

  if (styleId) {
    const styleName = getStyleName(styleId);
    if (styleName) {
      const variableName = figmaStyleNameToEnglishVariable(styleName);
      if (variableName) {
        if (DEBUG_MODE) {
          console.log(`样式转换: "${styleName}" -> "${variableName}"`);
          console.log(`生成: var(${variableName}, ${colorString})`);
        }
        return `var(${variableName}, ${colorString})`;
      } else if (DEBUG_MODE) {
        console.log(`样式名转换失败: "${styleName}"`);
      }
    } else if (DEBUG_MODE) {
      console.log(`样式ID "${styleId}" 对应的样式名未找到`);
    }
  } else if (DEBUG_MODE) {
    console.log(`无样式ID，使用直接颜色值: ${colorString}`);
  }

  return colorString;
}

// 生成带有样式变量的渐变值
function generateGradientWithStyleVariable(gradientCss: string, styleId?: string): string {
  if (styleId) {
    const styleName = getStyleName(styleId);
    if (styleName) {
      const variableName = figmaStyleNameToEnglishVariable(styleName);
      if (variableName) {
        if (DEBUG_MODE) {
          console.log(`渐变样式转换: "${styleName}" -> "${variableName}"`);
          console.log(`生成渐变: var(${variableName}, ${gradientCss})`);
        }
        return `var(${variableName}, ${gradientCss})`;
      } else if (DEBUG_MODE) {
        console.log(`渐变样式名转换失败: "${styleName}"`);
      }
    } else if (DEBUG_MODE) {
      console.log(`渐变样式ID "${styleId}" 对应的样式名未找到`);
    }
  } else if (DEBUG_MODE) {
    console.log(`无渐变样式ID，使用直接渐变值: ${gradientCss}`);
  }

  return gradientCss;
}


// 获取节点样式并生成微信小程序代码
function generateWechatMiniProgramCode(node: SceneNode, conversionRate: number): string {
  const styles: string[] = [];

  // 检查是否是文本节点
  const isTextNode = 'characters' in node && typeof (node as any).characters === 'string';

  // 获取所有样式ID
  const fillStyleId = (node as any).fillStyleId;
  const strokeStyleId = (node as any).strokeStyleId;
  const textStyleId = isTextNode ? (node as any).textStyleId : null;
  const effectStyleId = (node as any).effectStyleId;
  const gridStyleId = (node as any).gridStyleId;

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

  // 处理布局属性 - display
  if ('layoutMode' in node) {
    const layoutMode = (node as any).layoutMode;
    if (layoutMode === 'HORIZONTAL' || layoutMode === 'VERTICAL') {
      styles.push(`display: flex`);

      // flex-direction
      if (layoutMode === 'HORIZONTAL') {
        styles.push(`flex-direction: row`);
      } else {
        styles.push(`flex-direction: column`);
      }

      // justify-content (primary axis alignment)
      if ('primaryAxisAlignItems' in node) {
        const alignment = (node as any).primaryAxisAlignItems;
        const justifyContentMap: Record<string, string> = {
          'MIN': 'flex-start',
          'CENTER': 'center',
          'MAX': 'flex-end',
          'SPACE_BETWEEN': 'space-between'
        };
        if (justifyContentMap[alignment]) {
          styles.push(`justify-content: ${justifyContentMap[alignment]}`);
        }
      }

      // align-items (counter axis alignment)
      if ('counterAxisAlignItems' in node) {
        const alignment = (node as any).counterAxisAlignItems;
        const alignItemsMap: Record<string, string> = {
          'MIN': 'flex-start',
          'CENTER': 'center',
          'MAX': 'flex-end',
          'BASELINE': 'baseline'
        };
        if (alignItemsMap[alignment]) {
          styles.push(`align-items: ${alignItemsMap[alignment]}`);
        }
      }

      // gap (item spacing)
      if ('itemSpacing' in node && typeof (node as any).itemSpacing === 'number' && (node as any).itemSpacing > 0) {
        const gapPx = (node as any).itemSpacing;
        const gapRpx = pxToRpx(gapPx, conversionRate);
        const variableName = getSpacingVariableName(gapPx);
        styles.push(`gap: var(${variableName}, ${gapRpx}rpx)`);
      }
    }
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

    // 生成变量引用函数
    const spacingVar = (px: number, rpx: number): string => {
      if (px === 0) return '0';
      const variableName = getSpacingVariableName(px);
      return `var(${variableName}, ${rpx}rpx)`;
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
    // 生成变量引用函数（与margin部分相同）
    const spacingVar = (px: number, rpx: number): string => {
      if (px === 0) return '0';
      const variableName = getSpacingVariableName(px);
      return `var(${variableName}, ${rpx}rpx)`;
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
          // 对于颜色样式，始终使用fillStyleId
          const styleId = fillStyleId;
          const color = generateColorWithStyleVariable(visibleFill.color, styleId);
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
              const color = generateColorWithStyleVariable(firstStop.color, styleId);
              styles.push(`color: ${color}`);
            }
          } else {
            // 非文本节点，生成渐变背景
            const styleId = fillStyleId;
            const gradientWithVar = generateGradientWithStyleVariable(gradientCss, styleId);
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
        strokeColor = generateColorWithStyleVariable(stroke.color, strokeStyleId);
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
      const fontSizeRpx = pxToRpx((node as any).fontSize, conversionRate);
      styles.push(`font-size: ${fontSizeRpx}rpx`);
    }

    // 字体粗细
    if ('fontWeight' in node && (node as any).fontWeight !== figma.mixed && typeof (node as any).fontWeight === 'number') {
      const weight = (node as any).fontWeight;
      let fontWeight = weight.toString();
      if (weight === 400) fontWeight = 'normal';
      if (weight === 700) fontWeight = 'bold';
      styles.push(`font-weight: ${fontWeight}`);
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
      styles.push(`font-family: "${fontFamily}"`);
    }

    // 行高
    if ('lineHeight' in node && (node as any).lineHeight !== figma.mixed) {
      const lineHeight = (node as any).lineHeight;
      if (typeof lineHeight === 'number' && lineHeight > 0) {
        const lineHeightRpx = pxToRpx(lineHeight, conversionRate);
        styles.push(`line-height: ${lineHeightRpx}rpx`);
      } else if (typeof lineHeight === 'object' && lineHeight !== null) {
        if (lineHeight.unit === 'PIXELS' && typeof lineHeight.value === 'number') {
          const lineHeightRpx = pxToRpx(lineHeight.value, conversionRate);
          styles.push(`line-height: ${lineHeightRpx}rpx`);
        } else if (lineHeight.unit === 'PERCENT' && typeof lineHeight.value === 'number') {
          styles.push(`line-height: ${lineHeight.value}%`);
        }
      }
    }

    // 字间距
    if ('letterSpacing' in node && (node as any).letterSpacing !== figma.mixed) {
      const letterSpacing = (node as any).letterSpacing;
      if (typeof letterSpacing === 'number') {
        const letterSpacingRpx = pxToRpx(letterSpacing, conversionRate);
        styles.push(`letter-spacing: ${letterSpacingRpx}rpx`);
      } else if (typeof letterSpacing === 'object' && letterSpacing !== null) {
        if (letterSpacing.unit === 'PIXELS' && typeof letterSpacing.value === 'number') {
          const letterSpacingRpx = pxToRpx(letterSpacing.value, conversionRate);
          styles.push(`letter-spacing: ${letterSpacingRpx}rpx`);
        } else if (letterSpacing.unit === 'PERCENT' && typeof letterSpacing.value === 'number') {
          styles.push(`letter-spacing: ${letterSpacing.value}%`);
        }
      }
    }

    // 文本对齐
    if ('textAlignHorizontal' in node && (node as any).textAlignHorizontal !== figma.mixed && typeof (node as any).textAlignHorizontal === 'string') {
      const align = (node as any).textAlignHorizontal.toLowerCase();
      styles.push(`text-align: ${align}`);
    }

    // 文本装饰
    if ('textDecoration' in node && (node as any).textDecoration !== figma.mixed && typeof (node as any).textDecoration === 'string') {
      const decoration = (node as any).textDecoration.toLowerCase();
      styles.push(`text-decoration: ${decoration}`);
    }

    // 文本大小写
    if ('textCase' in node && (node as any).textCase !== figma.mixed && typeof (node as any).textCase === 'string') {
      const textCase = (node as any).textCase.toLowerCase();
      if (textCase === 'upper') {
        styles.push(`text-transform: uppercase`);
      } else if (textCase === 'lower') {
        styles.push(`text-transform: lowercase`);
      } else if (textCase === 'title') {
        styles.push(`text-transform: capitalize`);
      }
    }
  }

  // 处理透明度
  if ('opacity' in node && typeof node.opacity === 'number') {
    styles.push(`opacity: ${node.opacity}`);
  }

  // 将样式数组连接为字符串，每行一个样式
  return styles.join(';\n') + (styles.length > 0 ? ';' : '');
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
  // 如果没有alpha或alpha为1，使用十六进制
  if (color.a === undefined || Math.abs(color.a - 1) < 0.001) {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
  } else {
    // 使用rgba
    return `rgba(${r}, ${g}, ${b}, ${color.a.toFixed(3)})`;
  }
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

// 加载保存的转换倍率
async function loadConversionRate() {
  try {
    const savedRate = await figma.clientStorage.getAsync('conversionRate');
    if (savedRate !== undefined) {
      currentConversionRate = savedRate;
    }
  } catch (error) {
    console.error('加载转换倍率失败:', error);
  }
}

// 保存转换倍率
async function saveConversionRate(rate: number) {
  try {
    await figma.clientStorage.setAsync('conversionRate', rate);
    currentConversionRate = rate;
    return true;
  } catch (error) {
    console.error('保存转换倍率失败:', error);
    return false;
  }
}

// 初始化加载设置
loadConversionRate();

// 处理插件命令
figma.on('run', ({ command }) => {
  if (command === 'show-settings') {
    // 显示设置界面
    figma.showUI(__html__, { width: 400, height: 700 });

    // 处理来自UI的消息
    figma.ui.onmessage = async (msg) => {
      if (msg.type === 'saveSettings') {
        const success = await saveConversionRate(msg.conversionRate);
        if (success) {
          figma.ui.postMessage({
            type: 'settingsSaved',
            conversionRate: msg.conversionRate
          });
        }
      } else if (msg.type === 'loadSettings') {
        await loadConversionRate();
        figma.ui.postMessage({
          type: 'settingsLoaded',
          conversionRate: currentConversionRate
        });
      }
    };
  } else if (command === 'about') {
    figma.notify('微信小程序单位转换插件 v1.0 - 将Figma中的px转换为微信小程序的rpx单位');
  }
});

// This provides the callback to generate the code.
figma.codegen.on('generate', (event) => {
  const node = event.node;

  // 使用当前转换倍率
  const code = generateWechatMiniProgramCode(node, currentConversionRate);

  return [
    {
      language: 'CSS',
      code: code,
      title: '微信小程序样式 (WXSS)',
    },
  ];
});
