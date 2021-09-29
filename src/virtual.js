/**
 * virtual list core calculating center
 */

const DIRECTION_TYPE = {
  FRONT: 'FRONT', // scroll up or left
  BEHIND: 'BEHIND' // scroll down or right
}
const CALC_TYPE = {
  INIT: 'INIT',
  FIXED: 'FIXED',
  DYNAMIC: 'DYNAMIC'
}
const LEADING_BUFFER = 2

export default class Virtual {
  constructor (param, callUpdate) {
    this.init(param, callUpdate)
  }

  init (param, callUpdate) {
    // param data
    this.param = param
    this.callUpdate = callUpdate

    // size data
    this.sizes = new Map()
    this.firstRangeTotalSize = 0
    this.firstRangeAverageSize = 0
    this.lastCalcIndex = 0
    this.fixedSizeValue = 0
    this.calcType = CALC_TYPE.INIT

    // scroll data
    this.offset = 0
    this.direction = ''

    // range data
    this.range = Object.create(null)
    if (param) {
      // 无论 start 参数是多少，都需要从 0 开始初始化渲染一个渲染范围的数据，否则无法取到子组件的 dom 数据
      this.checkRange(0, param.keeps - 1)
    }

    // benchmark test data
    // this.__bsearchCalls = 0
    // this.__getIndexOffsetCalls = 0
  }

  destroy () {
    this.init(null, null)
  }

  // return current render range
  // 当前渲染数据的范围：开始/结束索引、前后/左右边距
  getRange () {
    const range = Object.create(null)
    range.start = this.range.start
    range.end = this.range.end
    range.padFront = this.range.padFront
    range.padBehind = this.range.padBehind
    return range
  }

  // 下滑或右滑
  isBehind () {
    return this.direction === DIRECTION_TYPE.BEHIND
  }

  // 上滑或左滑
  isFront () {
    return this.direction === DIRECTION_TYPE.FRONT
  }

  // return start index offset
  // 计算 start 这个索引的位置
  getOffset (start) {
    return (start < 1 ? 0 : this.getIndexOffset(start)) + this.param.slotHeaderSize
  }

  updateParam (key, value) {
    if (this.param && (key in this.param)) {
      // if uniqueIds change, find out deleted id and remove from size map
      if (key === 'uniqueIds') {
        this.sizes.forEach((v, key) => {
          if (!value.includes(key)) {
            this.sizes.delete(key)
          }
        })
      }
      this.param[key] = value
    }
  }

  // save each size map by id
  saveSize (id, size) {
    // 通过数据唯一标识记录当前这条数据渲染到页面中的实际大小（高度/宽度）
    this.sizes.set(id, size)

    // we assume size type is fixed at the beginning and remember first size value
    // if there is no size value different from this at next comming saving
    // we think it's a fixed size list, otherwise is dynamic size list

    // 假设在第一次保存的时候这个大小时固定的，并且把第一个的大小作为这个列表子项固定大小
    // 在下一次保存的时候，如果这个大小与固定大小不一致，那就认为这个列表的每一项是动态高度的列表
    if (this.calcType === CALC_TYPE.INIT) {
      this.fixedSizeValue = size
      this.calcType = CALC_TYPE.FIXED
    } else if (this.calcType === CALC_TYPE.FIXED && this.fixedSizeValue !== size) {
      this.calcType = CALC_TYPE.DYNAMIC
      // it's no use at all
      delete this.fixedSizeValue
    }

    // calculate the average size only in the first range
    // 如果是个动态高度列表，计算并且只需要计算第一个渲染范围数据的平均高度
    if (this.calcType !== CALC_TYPE.FIXED && typeof this.firstRangeTotalSize !== 'undefined') {
      // 计算动态高度中的第一屏渲染的元素的平均高度
      // 疑问：
      // 这里的计算为什么不处理为：
      // this.sizes.size > Math.max(this.param.keeps, this.param.uniqueIds.length) - 1
      // 这样就只用计算一次
      if (this.sizes.size < Math.min(this.param.keeps, this.param.uniqueIds.length)) {
        this.firstRangeTotalSize = [...this.sizes.values()].reduce((acc, val) => acc + val, 0)
        this.firstRangeAverageSize = Math.round(this.firstRangeTotalSize / this.sizes.size)
      } else {
        // it's done using
        // 第一个渲染区间平均高度计算完之后，删掉这个字段，因为只需要计算第一个渲染区间的平均大小
        delete this.firstRangeTotalSize
      }
    }
  }

  // in some special situation (e.g. length change) we need to update in a row
  // try goiong to render next range by a leading buffer according to current direction
  handleDataSourcesChange () {
    let start = this.range.start

    if (this.isFront()) {
      start = start - LEADING_BUFFER
    } else if (this.isBehind()) {
      start = start + LEADING_BUFFER
    }

    start = Math.max(start, 0)

    this.updateRange(this.range.start, this.getEndByStart(start))
  }

  // when slot size change, we also need force update
  handleSlotSizeChange () {
    this.handleDataSourcesChange()
  }

  // calculating range on scroll
  handleScroll (offset) {
    this.direction = offset < this.offset ? DIRECTION_TYPE.FRONT : DIRECTION_TYPE.BEHIND
    this.offset = offset

    if (!this.param) {
      return
    }

    if (this.direction === DIRECTION_TYPE.FRONT) {
      this.handleFront()
    } else if (this.direction === DIRECTION_TYPE.BEHIND) {
      this.handleBehind()
    }
  }

  // ----------- public method end -----------

  handleFront () {
    const overs = this.getScrollOvers()
    // should not change range if start doesn't exceed overs
    if (overs > this.range.start) {
      return
    }

    // move up start by a buffer length, and make sure its safety
    const start = Math.max(overs - this.param.buffer, 0)
    this.checkRange(start, this.getEndByStart(start))
  }

  handleBehind () {
    const overs = this.getScrollOvers()
    // range should not change if scroll overs within buffer
    if (overs < this.range.start + this.param.buffer) {
      return
    }

    this.checkRange(overs, this.getEndByStart(overs))
  }

  // return the pass overs according to current scroll offset
  getScrollOvers () {
    // if slot header exist, we need subtract its size
    const offset = this.offset - this.param.slotHeaderSize
    if (offset <= 0) {
      return 0
    }

    // if is fixed type, that can be easily
    if (this.isFixedType()) {
      return Math.floor(offset / this.fixedSizeValue * this.param.dataPerRow)
    }

    let low = 0
    let middle = 0
    let middleOffset = 0
    let high = this.param.uniqueIds.length

    while (low <= high) {
      // this.__bsearchCalls++
      middle = low + Math.floor((high - low) / 2)
      middleOffset = this.getIndexOffset(middle)

      if (middleOffset === offset) {
        return middle
      } else if (middleOffset < offset) {
        low = middle + 1
      } else if (middleOffset > offset) {
        high = middle - 1
      }
    }

    return low > 0 ? --low : 0
  }

  // return a scroll offset from given index, can efficiency be improved more here?
  // although the call frequency is very high, its only a superposition of numbers
  getIndexOffset (givenIndex) {
    if (!givenIndex) {
      return 0
    }

    let offset = 0
    let indexSize = 0

    // 遍历当前需要获取的索引的前面所有数据节点的大小，叠加之和就是当前索引的上/左偏移量
    for (let index = 0; index < givenIndex; index++) {
      // this.__getIndexOffsetCalls++
      // 通过唯一标识去 sizes 中获取各自的大小
      indexSize = this.sizes.get(this.param.uniqueIds[index])
      // 如果这个高度还没有存下来，就去取一个预估的高度/宽度
      // 预估的高度/宽度: 如果是每一项大小是固定的，那就是这个固定值，否则就是第一个渲染区间的平均值 或者 用户自定义的大小。动态列表时，这个大小是不精确的，只是一个预估值
      offset = offset + (typeof indexSize === 'number' ? indexSize : this.getEstimateSize())
    }

    // remember last calculate index
    // 记录最后一个计算的索引
    // 取 已经记录的最后一个计算值的索引 与 当前索引 的最大值
    this.lastCalcIndex = Math.max(this.lastCalcIndex, givenIndex - 1)
    // 取 当前记录的计算索引 与 数据列表最后一条数据索引 的最小值
    this.lastCalcIndex = Math.min(this.lastCalcIndex, this.getLastIndex())

    return offset / this.param.dataPerRow
  }

  // is fixed size type
  isFixedType () {
    // 查看这个列表是固定高度/宽度列表还是动态高度/宽度列表
    // 这里的高度/宽度指的是子组件(每一个数据子项)
    return this.calcType === CALC_TYPE.FIXED
  }

  // return the real last index
  // 获取真实所有数据（不是渲染数据）的最后一条的索引
  getLastIndex () {
    return this.param.uniqueIds.length - 1
  }

  // in some conditions range is broke, we need correct it
  // and then decide whether need update to next range
  checkRange (start, end) {
    const keeps = this.param.keeps
    const total = this.param.uniqueIds.length

    // datas less than keeps, render all
    if (total <= keeps) {
      // 数据总条数小于设置的渲染的条数时，直接渲染所有数据
      start = 0
      end = this.getLastIndex()
    } else if (end - start < keeps - 1) {
      // if range length is less than keeps, corrent it base on end
      // 如果渲染最后一批数据的时候不足 keep 条，那么就把开始渲染的数据索引计算出来，凑够 keep 条数据
      start = end - keeps + 1
    }

    if (this.range.start !== start) {
      // 更新当前渲染数据的范围索引
      this.updateRange(start, end)
    }
  }

  // setting to a new range and rerender
  updateRange (start, end) {
    // 当前渲染数据的开始、结束的索引
    this.range.start = start
    this.range.end = end

    // 计算渲染区域的上/左边距
    this.range.padFront = this.getPadFront()
    // 计算渲染区域的下/右边距
    this.range.padBehind = this.getPadBehind()

    // 回调函数，将当前修改后的渲染相关数据范围传回组件
    this.callUpdate(this.getRange())
  }

  // return end base on start
  getEndByStart (start) {
    const theoryEnd = start + this.param.keeps - 1
    const truelyEnd = Math.min(theoryEnd, this.getLastIndex())
    return truelyEnd
  }

  // return total front offset
  // 计算容器左边距/上边距
  getPadFront () {
    if (this.isFixedType()) {
      // 如果是固定相同大小的话，边距就是当前渲染数据第一条的索引 * 固定的高度/宽度
      return this.fixedSizeValue * this.range.start / this.param.dataPerRow
    } else {
      // 否则就找到当前渲染数据第一条所在位置的偏移量
      return this.getIndexOffset(this.range.start)
    }
  }

  // return total behind offset
  // 计算容器下边距/右边距
  getPadBehind () {
    const end = this.range.end
    const lastIndex = this.getLastIndex()

    if (this.isFixedType()) {
      // 如果列表分录是固定高度的，直接返回渲染的最后一条数据到所有的数据最后一条数据的高度作为偏移量
      return (lastIndex - end) * this.fixedSizeValue / this.param.dataPerRow
    }

    // if it's all calculated, return the exactly offset
    if (this.lastCalcIndex === lastIndex) {
      // 如果已经计算到最后一条数据了，直接使用 底部/右边偏移量 = 最后一条数据的偏移量 - 当前渲染的最后一条数据偏移量
      return this.getIndexOffset(lastIndex) - this.getIndexOffset(end)
    } else {
      // if not, use a estimated value
      // 否则的话，使用 预估大小 * 底部/右侧数据未渲染条数
      return (lastIndex - end) * this.getEstimateSize() / this.param.dataPerRow
    }
  }

  // get the item estimate size
  getEstimateSize () {
    // 如果是固定大小，就使用固定大小值即可
    // 否则就使用第一个渲染数据范围的平均高度或者用户设置的 estimateSize 参数值
    return this.isFixedType() ? this.fixedSizeValue : (this.firstRangeAverageSize || this.param.estimateSize)
  }
}
