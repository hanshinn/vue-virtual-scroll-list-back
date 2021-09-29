/**
 * virtual list default component
 */

import Vue from 'vue'
import Virtual from './virtual'
import { Item, Slot } from './item'
import { VirtualProps } from './props'

const EVENT_TYPE = {
  ITEM: 'item_resize',
  SLOT: 'slot_resize'
}
const SLOT_TYPE = {
  HEADER: 'thead', // string value also use for aria role attribute
  FOOTER: 'tfoot'
}

const VirtualList = Vue.component('virtual-list', {
  props: VirtualProps,

  data () {
    return {
      range: null
    }
  },

  watch: {
    'dataSources.length' () {
      this.virtual.updateParam('uniqueIds', this.getUniqueIdFromDataSources())
      this.virtual.handleDataSourcesChange()
    },

    keeps (newValue) {
      this.virtual.updateParam('keeps', newValue)
      this.virtual.handleSlotSizeChange()
    },

    start (newValue) {
      this.scrollToIndex(newValue)
    },

    offset (newValue) {
      this.scrollToOffset(newValue)
    }
  },

  created () {
    // this.isHorizontal Bool 是否是水平滚动
    this.isHorizontal = this.direction === 'horizontal'

    // this.directionKey 方向的标识 【上下滚动：距离顶部的像素，左右滚动：距离左边的像素】
    this.directionKey = this.isHorizontal ? 'scrollLeft' : 'scrollTop'

    // 创建一个Virtual实例对象：this.virtual
    this.installVirtual()

    // listen item size change
    // 监听列表子项的大小变化【对应在本组件的 virtual-list-item 组件中。文件路径：'./item.js'】
    this.$on(EVENT_TYPE.ITEM, this.onItemResized)

    // listen slot size change
    // 如果有插槽，也需要监听这两个插槽的变化
    if (this.$slots.header || this.$slots.footer) {
      this.$on(EVENT_TYPE.SLOT, this.onSlotResized)
    }
  },

  // set back offset when awake from keep-alive
  activated () {
    this.scrollToOffset(this.virtual.offset)
  },

  mounted () {
    // set position
    if (this.start) {
      // 如果 start 传了值，并且不为 0，就需要滚动到 start 这个位置
      this.scrollToIndex(this.start)
    } else if (this.offset) {
      // 如果 start 没有设置非 0 值
      // 如果 offset 传了值，就向下滚动 offset 个像素
      this.scrollToOffset(this.offset)
    }

    // in page mode we bind scroll event to document
    if (this.pageMode) {
      this.updatePageModeFront()

      document.addEventListener('scroll', this.onScroll, {
        passive: false
      })
    }
  },

  beforeDestroy () {
    this.virtual.destroy()
    if (this.pageMode) {
      document.removeEventListener('scroll', this.onScroll)
    }
  },

  methods: {
    // get item size by id
    getSize (id) {
      return this.virtual.sizes.get(id)
    },

    // get the total number of stored (rendered) items
    getSizes () {
      return this.virtual.sizes.size
    },

    // return current scroll offset
    // 滚动位置的上/左偏移量
    getOffset () {
      // scrollTop / scrollLeft
      if (this.pageMode) {
        return document.documentElement[this.directionKey] || document.body[this.directionKey]
      } else {
        const { root } = this.$refs
        return root ? Math.ceil(root[this.directionKey]) : 0
      }
    },

    // return client viewport size
    // dom 自身的 高度/宽度
    getClientSize () {
      const key = this.isHorizontal ? 'clientWidth' : 'clientHeight'
      if (this.pageMode) {
        return document.documentElement[key] || document.body[key]
      } else {
        const { root } = this.$refs
        return root ? Math.ceil(root[key]) : 0
      }
    },

    // return all scroll size
    // 整个滚动视图的高度（包含不可视区域）
    getScrollSize () {
      const key = this.isHorizontal ? 'scrollWidth' : 'scrollHeight'
      if (this.pageMode) {
        return document.documentElement[key] || document.body[key]
      } else {
        const { root } = this.$refs
        return root ? Math.ceil(root[key]) : 0
      }
    },

    // set current scroll position to a expectant offset
    // 将当前滚动位置设置到 offset 这个位置
    scrollToOffset (offset) {
      // 区分是整个页面作为滚动区域还是指定处理了一个滚动区域
      if (this.pageMode) {
        document.body[this.directionKey] = offset
        document.documentElement[this.directionKey] = offset
      } else {
        const { root } = this.$refs
        if (root) {
          root[this.directionKey] = offset
        }
      }
    },

    // set current scroll position to a expectant index
    // 滚动到当前的这个索引 index 位置
    scrollToIndex (index) {
      // scroll to bottom
      // 如果这个索引是最后一个或者超过最后一个，就直接滚动到最底部/最右部
      if (index >= this.dataSources.length - 1) {
        this.scrollToBottom()
      } else {
        // 否则就计算需要滚动的距离
        const offset = this.virtual.getOffset(index)
        this.scrollToOffset(offset)
      }
    },

    // set current scroll position to bottom
    // 设置滚动位置到滚动区域的最底部
    scrollToBottom () {
      const { shepherd } = this.$refs
      if (shepherd) {
        const offset = shepherd[this.isHorizontal ? 'offsetLeft' : 'offsetTop']
        this.scrollToOffset(offset)

        // check if it's really scrolled to the bottom
        // maybe list doesn't render and calculate to last range
        // so we need retry in next event loop until it really at bottom
        // 检查是否真的滚动到最底部
        setTimeout(() => {
          // 如果 当前区域的偏移量 + 当前dom的自身高度或宽度 小于 滚动区域的大小，就需要重新调整滚动至底部区域
          if (this.getOffset() + this.getClientSize() < this.getScrollSize()) {
            this.scrollToBottom()
          }
        }, 3)
      }
    },

    // when using page mode we need update slot header size manually
    // taking root offset relative to the browser as slot header size
    // 如果 pageMode 参数为 true 的话， 需要手动更新偏移量为 root 相对于父元素(浏览器窗口)的上/左距离大小
    updatePageModeFront () {
      // 找到 root 这个 dom
      const { root } = this.$refs
      if (root) {
        const rect = root.getBoundingClientRect()

        // https://developer.mozilla.org/zh-CN/docs/Web/API/Node/ownerDocument
        const { defaultView } = root.ownerDocument

        // pageXOffset 设置或返回当前页面相对于窗口显示区左上角的 X 位置。pageYOffset 设置或返回当前页面相对于窗口显示区左上角的 Y 位置。
        // pageXOffset 和 pageYOffset 属性相等于 scrollX 和 scrollY 属性。
        const offsetFront = this.isHorizontal ? (rect.left + defaultView.pageXOffset) : (rect.top + defaultView.pageYOffset)
        this.virtual.updateParam('slotHeaderSize', offsetFront)
      }
    },

    // reset all state back to initial
    reset () {
      this.virtual.destroy()
      this.scrollToOffset(0)
      this.installVirtual()
    },

    // ----------- public method end -----------

    installVirtual () {
      this.virtual = new Virtual({
        slotHeaderSize: 0,
        slotFooterSize: 0,
        keeps: this.keeps * this.dataPerRow,
        estimateSize: this.estimateSize,
        dataPerRow: this.dataPerRow,
        buffer: Math.round(this.keeps / 3), // recommend for a third of keeps
        uniqueIds: this.getUniqueIdFromDataSources()
      }, this.onRangeChanged)

      // sync initial range
      // 疑问：在 new Virtual 的 onRangeChanged 回调中已经赋值了初始化的 range，为什么这里还要重新去赋值一次
      this.range = this.virtual.getRange()
    },

    getUniqueIdFromDataSources () {
      const { dataKey } = this
      return this.dataSources.map((dataSource) => typeof dataKey === 'function' ? dataKey(dataSource) : dataSource[dataKey])
    },

    // event called when each item mounted or size changed
    // 监听事件，子组件（分录）的监听
    onItemResized (id, size) {
      this.virtual.saveSize(id, size)
      this.$emit('resized', id, size)
    },

    // event called when slot mounted or size changed
    onSlotResized (type, size, hasInit) {
      if (type === SLOT_TYPE.HEADER) {
        this.virtual.updateParam('slotHeaderSize', size)
      } else if (type === SLOT_TYPE.FOOTER) {
        this.virtual.updateParam('slotFooterSize', size)
      }

      if (hasInit) {
        this.virtual.handleSlotSizeChange()
      }
    },

    // here is the rerendering entry
    onRangeChanged (range) {
      this.range = range
    },

    onScroll (evt) {
      const offset = this.getOffset()
      const clientSize = this.getClientSize()
      const scrollSize = this.getScrollSize()

      // iOS scroll-spring-back behavior will make direction mistake
      if (offset < 0 || (offset + clientSize > scrollSize + 1) || !scrollSize) {
        return
      }

      this.virtual.handleScroll(offset)
      this.emitEvent(offset, clientSize, scrollSize, evt)
    },

    // emit event in special position
    emitEvent (offset, clientSize, scrollSize, evt) {
      this.$emit('scroll', evt, this.virtual.getRange())

      if (this.virtual.isFront() && !!this.dataSources.length && (offset - this.topThreshold <= 0)) {
        this.$emit('totop')
      } else if (this.virtual.isBehind() && (offset + clientSize + this.bottomThreshold >= scrollSize)) {
        this.$emit('tobottom')
      }
    },

    // get the real render slots based on range data
    // in-place patch strategy will try to reuse components as possible
    // so those components that are reused will not trigger lifecycle mounted
    getRenderSlots (h) {
      const slots = []
      const { start, end } = this.range
      const { dataSources, dataKey, itemClass, itemTag, itemStyle, isHorizontal, extraProps, dataComponent, itemScopedSlots, dataPerRow } = this
      const itemCustomStyle = isHorizontal ? { 'writing-mode': 'horizontal-tb', height: `calc(100% / ${dataPerRow})` } : { width: `calc(100% / ${dataPerRow})` }
      for (let index = start; index <= end; index++) {
        const dataSource = dataSources[index]
        if (dataSource) {
          const uniqueKey = typeof dataKey === 'function' ? dataKey(dataSource) : dataSource[dataKey]
          if (typeof uniqueKey === 'string' || typeof uniqueKey === 'number') {
            slots.push(h(Item, {
              props: {
                index,
                tag: itemTag,
                event: EVENT_TYPE.ITEM,
                horizontal: isHorizontal,
                uniqueKey: uniqueKey,
                source: dataSource,
                extraProps: extraProps,
                component: dataComponent,
                scopedSlots: itemScopedSlots
              },
              style: Object.assign({}, itemStyle, itemCustomStyle),
              class: `${itemClass}${this.itemClassAdd ? ' ' + this.itemClassAdd(index) : ''}`
            }))
          } else {
            console.warn(`Cannot get the data-key '${dataKey}' from data-sources.`)
          }
        } else {
          console.warn(`Cannot get the index '${index}' from data-sources.`)
        }
      }
      return slots
    }
  },

  // render function, a closer-to-the-compiler alternative to templates
  // https://vuejs.org/v2/guide/render-function.html#The-Data-Object-In-Depth
  render (h) {
    const { header, footer } = this.$slots
    const { padFront, padBehind } = this.range
    const { isHorizontal, pageMode, rootTag, wrapTag, wrapClass, wrapStyle, headerTag, headerClass, headerStyle, footerTag, footerClass, footerStyle } = this
    const paddingStyle = { padding: isHorizontal ? `0px ${padBehind}px 0px ${padFront}px` : `${padFront}px 0px ${padBehind}px` }
    const layoutStyle = isHorizontal ? {
      display: 'flex',
      'flex-direction': 'row',
      'flex-wrap': 'wrap',
      'writing-mode': 'vertical-lr',
      height: '200px',
      overflow: 'hidden'
    } : {
      display: 'flex',
      'flex-direction': 'row',
      'flex-wrap': 'wrap'
    }
    const wrapperStyle = wrapStyle ? Object.assign({}, wrapStyle, paddingStyle, layoutStyle) : Object.assign({}, paddingStyle, layoutStyle)

    return h(rootTag, {
      ref: 'root',
      class: 'my-root-class',
      on: {
        '&scroll': !pageMode && this.onScroll
      }
    }, [
      // header slot
      header ? h(Slot, {
        class: headerClass,
        style: headerStyle,
        props: {
          tag: headerTag,
          event: EVENT_TYPE.SLOT,
          uniqueKey: SLOT_TYPE.HEADER
        }
      }, header) : null,

      // main list
      h(wrapTag, {
        class: wrapClass,
        attrs: {
          role: 'group'
        },
        style: wrapperStyle
      }, this.getRenderSlots(h)),

      // footer slot
      footer ? h(Slot, {
        class: footerClass,
        style: footerStyle,
        props: {
          tag: footerTag,
          event: EVENT_TYPE.SLOT,
          uniqueKey: SLOT_TYPE.FOOTER
        }
      }, footer) : null,

      // an empty element use to scroll to bottom
      // 这个节点渲染用于处理滚动到底部 => scrollToBottom 方法中使用
      h('div', {
        ref: 'shepherd',
        class: 'my-shepherd-class',
        style: {
          width: isHorizontal ? '0px' : '100%',
          height: isHorizontal ? '100%' : '0px'
        }
      })
    ])
  }
})

export default VirtualList
