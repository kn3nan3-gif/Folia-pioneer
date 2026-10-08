import { test as base } from '@playwright/test';
import { APP_VERSION, GUIDE_VERSION_STORAGE_KEY } from '../helpers/appState';

// test/component/fixtures.ts

/**
 * 组件用例的确定性起点。
 *
 * 为什么是 addInitScript 而不是塞进 gallery 的 window.mount：src/stores/* 在模块 import 时就读
 * localStorage，等 window.mount 执行，store 的初值早就定下来了。种子必须在页面脚本跑之前落地。
 *
 * localStorage.clear() 承担逐条隔离——所以 playwright.config.ts 里刻意没开 reuseContext，
 * 共享 context 会让这条 init script 累积，用例之间开始互相污染。
 */
export const test = base.extend<{ seededStorage: void }>({
    // Playwright's built-in mount navigates again on every call and immediately checks window.mount.
    // Own that navigation so readiness is checked in the document we actually mount, not a prior reload.
    mount: async ({ page, baseURL }, use) => {
        const callMount = (params: { story: string; props?: unknown }) => page.evaluate(
            async value => { await window.mount(value as Parameters<Window['mount']>[0]); }, params, { exposeFunctions: true },
        );
        await use(async (storyId, props) => {
            if (!baseURL) throw new Error('mount() requires baseURL to point at the component gallery.');
            await page.goto(baseURL);
            await page.waitForFunction(() => typeof window.mount === 'function');
            await callMount({ story: storyId, props });
            return Object.assign(page.locator('#root'), {
                update: (newProps?: typeof props) => callMount({ story: storyId, props: newProps }),
                unmount: () => page.evaluate(async () => { await window.unmount?.(); }),
            });
        });
    },
    seededStorage: [async ({ page }, use) => {
        await page.addInitScript(([version, guideKey]) => {
            localStorage.clear();
            localStorage.setItem('i18nextLng', 'en');
            localStorage.setItem('static_mode', 'true');
            localStorage.setItem(guideKey, version);
        }, [APP_VERSION, GUIDE_VERSION_STORAGE_KEY]);
        await use();
    }, { auto: true }],
});

export { expect } from '@playwright/test';
