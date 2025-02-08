import { Object3D } from 'three'
// I made the library without knowing the convention, plus it makes sense for a map
Object3D.DEFAULT_UP.set(0, 0, 1)
export * from './ground'
export * from './game'
export * from './utils'
export * from './three'
export * from './input'
