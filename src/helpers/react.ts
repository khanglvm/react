import {Children, isValidElement, JSXElementConstructor, ReactNode} from 'react'
import { deepEqual } from './deepEqual.js'

/**
 * Use comparePropsForMemo/ compareAllPropsForMemo function to quickly compare prop(s) for React.memo
 * Usage example:
 * memo(Component, compareAllPropsForMemo) // compare all props
 * memo(Component, comparePropsForMemo('title')) // compare only 'title' prop
 * memo(Component, comparePropsForMemo(['title', 'content'])) // compare 'title' and 'content' props
 * */

type TPropsAreEqualsCallback<P> = (prevProps: P, nextProps: P) => boolean

type TProps<P> = [P, P] | [Array<keyof P>] | [keyof P]

type TArgArr<P> = [Array<keyof P>] | [keyof P]

function isSingleArgument<P, A extends TArgArr<P>>(arg: TProps<P>): arg is A {
    return arg.length === 1
}

// Overload 1: When comparePropsForMemo receives previous props and current props, it should return boolean
export function compareAllPropsForMemo<P extends object>(arg1: P, arg2: P): boolean {
    return compareProps(arg1, arg2)
}

// Overload 2: When comparePropsForMemo receives key(s) of prop that need to be compared, it should return a function to later compare props
export function comparePropsForMemo<P extends object>(arg: Array<keyof P> | keyof P): TPropsAreEqualsCallback<P>

// Implementation of comparePropsForMemo
export function comparePropsForMemo<P extends object, A extends TProps<P>>(...args: A): unknown {
    if (isSingleArgument(args)) {
        return (prevProps: P, nextProps: P): boolean => {
            return compareProps(prevProps, nextProps, Array.isArray(args[0]) ? args[0] : [args[0]])
        }
    }
    return compareProps(args[0], args[1])
}

function compareProps<P extends object>(prevProps: P, nextProps: P, comparePropKeys?: Array<keyof P>): boolean {
    return !(
        comparePropKeys || Object.keys(prevProps).filter((key) => Object.prototype.hasOwnProperty.call(prevProps, key))
    ).some((key) => !deepEqual(prevProps[key as keyof P], nextProps[key as keyof P]))
}

export function isIterableChildren<T>(children: T): children is TReactFragment<T> {
    return Children.count(children) > 1
}

export function isSingleReactElementChildren<T>(child: T): child is TReactElement<T> {
    return (
        Children.count(child) === 1 &&
        typeof child !== 'string' &&
        typeof child !== 'number' &&
        typeof child !== 'boolean' &&
        child !== undefined &&
        child !== null
    )
}

export function isReactFragmentChildren<T>(child: T): child is TReactElement<T> {
    return (
        isSingleReactElementChildren(child) &&
        (child as { type: unknown }).type !== undefined &&
        (child as { type: string | number }).type.toString() === Symbol('react.fragment').toString()
    )
}

export function isHTMLElementChildren<T>(child: T): child is TReactElement<T> {
    return isSingleReactElementChildren(child) && !isReactFragmentChildren(child)
}

export function isEmptyChildren<T>(children: T): children is TEmptyChildren<T> {
    return children === undefined || children === null
}

export function isPrimitiveChildren<T>(children: T): children is TPrimitiveChildren<T> {
    return typeof children === 'string' || typeof children === 'number' || typeof children === 'boolean'
}

type TEmpty = undefined | null | ''

type TPrimitive = string | number | boolean

type TPrimitiveChildren<T> = T extends TPrimitive ? T : never
type TEmptyChildren<T> = T extends TEmpty ? T : never

type TReactElement<T> = T extends TPrimitiveChildren<T> ? never : T extends TEmptyChildren<T> ? never : T

type TReactFragment<T> = T extends Iterable<ReactNode> ? T : never

export const filterComponentFromChildren = <T extends JSXElementConstructor<any>>(children: ReactNode | ReactNode[], Component: T) => Children.toArray(children)
  .filter(isValidElement)
  .filter((child) => child.type === Component)
