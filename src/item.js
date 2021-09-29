/**
 * item and slot component both use similar wrapper
 * we need to know their size change at any time
 */

import Vue from 'vue'
import { ItemProps, SlotProps } from './props'

const Wrapper = {
  created () {
    this.shapeKey = this.horizontal ? 'offsetWidth' : 'offsetHeight'
  },

  mounted () {
    // https://developer.mozilla.org/zh-CN/docs/Web/API/ResizeObserver
    // ResizeObserver 接口可以监听到 Element 的内容区域或 SVGElement的边界框改变。内容区域则需要减去内边距padding。
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.dispatchSizeChange()
      })

      // 开始观察指定的 Element或 SVGElement。
      this.resizeObserver.observe(this.$el)
    }
  },

  // since componet will be reused, so disptach when updated
  updated () {
    this.dispatchSizeChange()
  },

  beforeDestroy () {
    if (this.resizeObserver) {
      // 取消和结束目标对象上所有对 Element或 SVGElement 观察。
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
  },

  methods: {
    getCurrentSize () {
      // 获取当前子元素（Item）节点元素的 物理宽度/高度
      return this.$el ? this.$el[this.shapeKey] : 0
    },

    // tell parent current size identify by unqiue key
    dispatchSizeChange () {
      // this.event: 父元素传过来的事件类型 { String } EVENT_TYPE.ITEM=>'item_resize'
      // this.uniqueKey: 父元素传过来的唯一标识 { String } 用户自定义的唯一 key => props.dataKey
      // this.hasInitial: 未知（未找到该参数的来源）该参数在监听的事件中也没有使用到
      this.$parent.$emit(this.event, this.uniqueKey, this.getCurrentSize(), this.hasInitial)
    }
  }
}

// wrapping for item
export const Item = Vue.component('virtual-list-item', {
  mixins: [Wrapper],

  props: ItemProps,

  render (h) {
    const { tag, component, extraProps = {}, index, source, scopedSlots = {}, uniqueKey } = this
    const props = {
      ...extraProps,
      source,
      index
    }

    return h(tag, {
      key: uniqueKey,
      attrs: {
        role: 'listitem'
      }
    }, [h(component, {
      props,
      scopedSlots: scopedSlots
    })])
  }
})

// wrapping for slot
export const Slot = Vue.component('virtual-list-slot', {
  mixins: [Wrapper],

  props: SlotProps,

  render (h) {
    const { tag, uniqueKey } = this

    return h(tag, {
      key: uniqueKey,
      attrs: {
        role: uniqueKey
      }
    }, this.$slots.default)
  }
})
