/**
 * props declaration for default, item and slot component
 */

export const VirtualProps = {
  dataKey: {
    // 数据分录唯一标识
    type: [String, Function],
    required: true
  },
  dataSources: {
    // 滚动区域数据列表
    type: Array,
    required: true
  },
  dataComponent: {
    // 滚动内容单项子组件
    type: [Object, Function],
    required: true
  },
  dataPerRow: {
    // 每行显示的个数
    type: Number,
    default: 2
  },

  keeps: {
    // 滚动区域渲染的数据条数
    type: Number,
    default: 30
  },
  extraProps: {
    type: Object
  },
  estimateSize: {
    type: Number,
    default: 50
  },

  direction: {
    type: String,
    default: 'vertical' // the other value is horizontal
  },
  start: {
    // 设置一个初始值，从第几个开始显示在当前可视区域（渲染数据的索引）
    type: Number,
    default: 0
  },
  offset: {
    // 设置偏移量，向下偏移 offset 个像素
    type: Number,
    default: 0
  },
  topThreshold: {
    type: Number,
    default: 0
  },
  bottomThreshold: {
    type: Number,
    default: 0
  },
  pageMode: {
    // 是否是整个页面作为滚动区域进行渲染
    type: Boolean,
    default: false
  },
  rootTag: {
    type: String,
    default: 'div'
  },
  wrapTag: {
    type: String,
    default: 'div'
  },
  wrapClass: {
    type: String,
    default: ''
  },
  wrapStyle: {
    type: Object
  },
  itemTag: {
    type: String,
    default: 'div'
  },
  itemClass: {
    type: String,
    default: ''
  },
  itemClassAdd: {
    type: Function
  },
  itemStyle: {
    type: Object
  },
  headerTag: {
    type: String,
    default: 'div'
  },
  headerClass: {
    type: String,
    default: ''
  },
  headerStyle: {
    type: Object
  },
  footerTag: {
    type: String,
    default: 'div'
  },
  footerClass: {
    type: String,
    default: ''
  },
  footerStyle: {
    type: Object
  },
  itemScopedSlots: {
    type: Object
  }
}

export const ItemProps = {
  index: {
    type: Number
  },
  event: {
    type: String
  },
  tag: {
    type: String
  },
  horizontal: {
    type: Boolean
  },
  source: {
    type: Object
  },
  component: {
    type: [Object, Function]
  },
  uniqueKey: {
    type: [String, Number]
  },
  extraProps: {
    type: Object
  },
  scopedSlots: {
    type: Object
  }
}

export const SlotProps = {
  event: {
    type: String
  },
  uniqueKey: {
    type: String
  },
  tag: {
    type: String
  },
  horizontal: {
    type: Boolean
  }
}
