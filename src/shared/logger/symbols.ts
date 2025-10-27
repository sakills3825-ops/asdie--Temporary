/**
 * Logger 심볼 정의
 *
 * 각 프로세스(Main, Renderer)에서 독립적인 로거를 주입할 때 사용.
 * 심볼을 통해 서로 다른 Logger 인스턴스를 구분하고 Dependency Injection을 지원.
 */

export const LoggerSymbol = Symbol('Logger');
export type LoggerSymbol = typeof LoggerSymbol;

/**
 * Logger 심볼 정의: Main 프로세스용
 */
export const MainLoggerSymbol = Symbol('MainLogger');
export type MainLoggerSymbol = typeof MainLoggerSymbol;

/**
 * Logger 심볼 정의: Renderer 프로세스용
 */
export const RendererLoggerSymbol = Symbol('RendererLogger');
export type RendererLoggerSymbol = typeof RendererLoggerSymbol;
