import { expect, test, type Page } from '@playwright/test'

const setEnglishLocale = async (page: Page) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('ui_locale', 'en')
  })
}

const gotoReviewStage = async (page: Page) => {
  await page.getByTestId('cb-nav-continue').click()
  await page.getByTestId('cb-nav-continue').click()
  await expect(page.getByTestId('cb-stage-review')).toHaveClass(/is-current/)
}

test('scenario_1_setup_gate', async ({ page }) => {
  await setEnglishLocale(page)
  await page.goto('/')

  await page.getByTestId('cb-setup-rule-set-id').fill('')
  await page.getByTestId('cb-setup-sport').fill('')
  await page.getByTestId('cb-setup-sport-version').fill('')
  await expect(page.getByTestId('cb-nav-continue')).toBeDisabled()

  await page.getByTestId('cb-setup-rule-set-id').fill('baseball_swing_custom')
  await page.getByTestId('cb-setup-sport').fill('baseball')
  await page.getByTestId('cb-setup-sport-version').fill('1.0.0')
  await expect(page.getByTestId('cb-nav-continue')).toBeEnabled()

  await page.getByTestId('cb-nav-continue').click()
  await expect(page.getByTestId('cb-stage-steps')).toHaveClass(/is-current/)
})

test('scenario_2_validation_navigation', async ({ page }) => {
  await setEnglishLocale(page)
  await page.goto('/')

  await gotoReviewStage(page)
  await page.getByTestId('cb-review-validate').click()

  const phaseError = page.locator('[data-error-path^="phases[0]"]').first()
  await expect(phaseError).toBeVisible()
  await phaseError.click()

  await expect(page.getByTestId('cb-stage-steps')).toHaveClass(/is-current/)
})

test('scenario_3_export_guard', async ({ page }) => {
  await setEnglishLocale(page)
  await page.goto('/')

  await page.getByTestId('cb-setup-title').fill('Coach Test Title')
  await page.getByTestId('cb-nav-continue').click()

  await page.getByTestId('cb-steps-label').fill('Load Phase')
  await page.getByTestId('cb-checkpoints-label').fill('Head Stability')
  await page.getByTestId('cb-checkpoints-toggle-technical').click()
  await page.getByTestId('cb-checkpoints-category').fill('timing')
  await page.getByTestId('cb-condition-metric').first().fill('head_y')
  await page.getByTestId('cb-nav-continue').click()

  await page.getByTestId('cb-review-validate').click()
  await expect(page.getByTestId('cb-review-export')).toBeEnabled()
})
