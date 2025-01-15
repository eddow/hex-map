import { expect, test } from '@playwright/test'

test('home page has expected auto-load', async ({ page }) => {
	await page.goto('/')
	await expect(page.locator('.dv-default-tab-content')).toBeVisible()
	await expect(page.locator('.dv-default-tab-content')).toHaveText('test0')
	//await page.locator('button#addDvComp').click()
})
