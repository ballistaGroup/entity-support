'use strict'

const { Trait } = require('@northscaler/mutrait')
const {
  IllegalArgumentError,
  MissingRequiredArgumentError
} = require('@northscaler/error-support')
const { TreeCircularityError } = require('../errors')

const identity = (that, other) => that === other

const Treeness = Trait(
  superclass =>
    class extends superclass {
      _parent
      _children = []
      _equalityComparator = this._equalityComparator

      get isRoot () {
        return !this._parent
      }

      get children () {
        return [...this._children]
      }

      get childCount () {
        return this._children?.length || 0
      }

      get parent () {
        return this._parent
      }

      set parent (parent) {
        this.setParent(parent, identity)
      }

      setParent (parent, equalityComparator = this._equalityComparator) {
        if (!parent)
          throw new MissingRequiredArgumentError({ message: 'parent' })

        this._testSetParent(parent, equalityComparator)
        parent._testAddChild(this, equalityComparator)

        this._doSetParent(parent)
        parent._doAddChild(this)
      }

      _testSetParent (parent, equalityComparator) {
        if (this._parent)
          throw new IllegalArgumentError({ message: 'this already has parent' })
        if (!parent) throw new MissingRequiredArgumentError({ info: 'parent' })
        this._confirmIsThisType(parent)
        if (equalityComparator(parent, this))
          throw new TreeCircularityError({ message: 'parent is child' })
        if (this.containsChild(parent, true, equalityComparator))
          throw new TreeCircularityError({
            message: 'parent already contained by this'
          })
        if (this.containedByParent(parent, true, equalityComparator))
          throw new TreeCircularityError({
            message: 'parent already contains this'
          })
        return parent
      }

      _doSetParent (parent) {
        this._parent = parent
      }

      _confirmIsThisType (that) {
        if (Object.getPrototypeOf(this) !== Object.getPrototypeOf(that))
          throw new IllegalArgumentError({
            info: that,
            message: 'node must be the same type of object as this'
          })
      }

      unsetParent (equalityComparator = this._equalityComparator) {
        // eslint-disable-next-line
        this._parent?.removeChild(this)
        return this
      }

      _testUnsetParent (parent, equalityComparator) {
        if (!equalityComparator(parent, this._parent))
          throw new IllegalArgumentError({
            message: 'this parent not given parent'
          })
      }

      _doUnsetParent () {
        delete this._parent
      }

      containsChild (
        child,
        recursively,
        equalityComparator = this._equalityComparator
      ) {
        if (!child) throw new MissingRequiredArgumentError({ info: 'child' })
        if (!this._children?.length) return false
        const contains = this._children.some(it =>
          equalityComparator(child, it)
        )
        if (contains || !recursively) return contains
        return this._children.some(it =>
          it.containsChild(child, recursively, equalityComparator)
        )
      }

      containedByParent (
        parent,
        recursively,
        equalityComparator = this._equalityComparator
      ) {
        if (!parent) throw new MissingRequiredArgumentError({ info: 'parent' })
        if (this.isRoot) return false
        const contained = equalityComparator(parent, this._parent)
        if (contained || !recursively) return contained
        let p = this._parent.parent
        while (p) {
          if (equalityComparator(p, parent)) return true
          p = p.parent
        }
        return false
      }

      addChild (child, equalityComparator = this._equalityComparator) {
        if (!child) throw new MissingRequiredArgumentError({ info: 'child' })
        this._confirmIsThisType(child)

        child.setParent(this, equalityComparator) // delegate to setter
        return this
      }

      _testAddChild (child, equalityComparator) {
        if (!child) throw new MissingRequiredArgumentError({ info: 'child' })
        if (this.containsChild(child, true, equalityComparator))
          throw new TreeCircularityError({
            message: 'this already contains child'
          })
        if (this.containedByParent(child, true, equalityComparator))
          throw new TreeCircularityError({
            message: 'this already contained by child'
          })

        return child
      }

      _doAddChild (child) {
        this._children = this._children || []
        this._children.push(child)
      }

      removeChild (child, equalityComparator = this._equalityComparator) {
        if (!child) throw new MissingRequiredArgumentError({ info: 'child' })

        this._testRemoveChild(child, equalityComparator)
        child._testUnsetParent(this, equalityComparator)

        this._doRemoveChild(child)
        child._doUnsetParent()

        return this
      }

      _testRemoveChild (child, equalityComparator) {
        if (!this.containsChild(child, equalityComparator))
          throw new IllegalArgumentError({
            message: 'this does not contain child'
          })
      }

      _doRemoveChild (child) {
        const i = this._children.findIndex(it =>
          this._equalityComparator(child, it)
        )
        this._children.splice(i, 1)
      }

      get allChildren () {
        if (!this._children?.length) return []

        return this._children.reduce(
          (all, child) => {
            return (all = all.concat(child.allChildren))
          },
          [...this._children]
        )
      }

      asNodeList (nodeTransformerFn) {
        nodeTransformerFn = nodeTransformerFn || (it => it)

        return (this._children || []).reduce(
          (accum, child) => {
            accum = accum.concat(child.asNodeList(nodeTransformerFn))
            return accum
          },
          [nodeTransformerFn(this)]
        )
      }

      asNodeMapByProperty (propertyName, nodeTransformerFn) {
        return this.asNodeList(nodeTransformerFn).reduce((object, node) => {
          object[node[propertyName]] = node
          return object
        }, {})
      }
    }
)

module.exports = Treeness
