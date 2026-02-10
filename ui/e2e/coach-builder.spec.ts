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

  await page.getByTestId('cb-setup-toggle-advanced').click()
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
  await page.getByTestId('cb-condition-metric').first().selectOption('head_displacement_delta_mean')
  await page.getByTestId('cb-nav-continue').click()

  await page.getByTestId('cb-review-validate').click()
  await expect(page.getByTestId('cb-review-export')).toBeEnabled()
})

test('scenario_4_joint_diagram_step_and_toggle', async ({ page }) => {
  await setEnglishLocale(page)
  await page.goto('/')
  await page.getByTestId('cb-nav-continue').click()

  await expect(page.getByTestId('cb-joint-diagram-step')).toBeVisible()
  await expect(page.getByTestId('cb-joint-diagram-checkpoint')).toBeVisible()

  const stepLegend = page.locator('[data-testid="cb-joint-diagram-step"] .cb-joint-legend')
  await stepLegend.locator('[data-point-id="1"]').click()
  await stepLegend.locator('[data-point-id="8"]').click()
  await stepLegend.locator('[data-point-id="12"]').click()

  await expect(page.getByTestId('cb-steps-joints-of-interest')).toHaveValue('1, 8, 12')
  await expect(
    stepLegend.locator('[data-point-id="1"][data-selected="true"]')
  ).toBeVisible()
  await expect(
    stepLegend.locator('[data-point-id="8"][data-selected="true"]')
  ).toBeVisible()
  await expect(
    stepLegend.locator('[data-point-id="12"][data-selected="true"]')
  ).toBeVisible()

  await page.getByTestId('cb-joint-diagram-toggle').click()
  await expect(page.locator('[data-testid="cb-joint-diagram-step"] svg')).toHaveCount(0)
  await page.getByTestId('cb-joint-diagram-toggle').click()
  await expect(page.locator('[data-testid="cb-joint-diagram-step"] svg')).toHaveCount(1)
})

test('scenario_5_joint_diagram_expert_condition_highlight', async ({ page }) => {
  await setEnglishLocale(page)
  await page.goto('/')
  await page.getByTestId('cb-nav-continue').click()

  await page.getByTestId('cb-checkpoints-new-condition-type').selectOption('angle')
  await page.getByRole('button', { name: 'Add condition' }).click()
  const angleJointDiagram = page.getByTestId('cb-joint-diagram-condition').first()
  const angleLegend = angleJointDiagram.locator('.cb-joint-legend')
  await angleLegend.locator('[data-point-id="1"]').click()
  await angleLegend.locator('[data-point-id="2"]').click()
  await angleLegend.locator('[data-point-id="3"]').click()
  await expect(page.getByTestId('cb-condition-angle-joints')).toHaveValue('1, 2, 3')

  await expect(
    angleLegend.locator('[data-point-id="2"][data-selected="true"]')
  ).toBeVisible()

  await page.getByTestId('cb-checkpoints-new-condition-type').selectOption('distance')
  await page.getByRole('button', { name: 'Add condition' }).click()
  const distanceJointDiagram = page.getByTestId('cb-joint-diagram-condition').nth(1)
  const distanceLegend = distanceJointDiagram.locator('.cb-joint-legend')
  await distanceLegend.locator('[data-point-id="11"]').click()
  await distanceLegend.locator('[data-point-id="14"]').click()
  await expect(page.getByTestId('cb-condition-distance-pair')).toHaveValue('11, 14')

  await expect(
    distanceLegend.locator('[data-point-id="11"][data-selected="true"]')
  ).toBeVisible()
  await expect(
    distanceLegend.locator('[data-point-id="14"][data-selected="true"]')
  ).toBeVisible()
})
