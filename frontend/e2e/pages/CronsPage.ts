import { type Page, type Locator } from '@playwright/test'

export class CronsPage {
  readonly addButton: Locator
  readonly rows: Locator
  readonly nameInput: Locator
  readonly scheduleInput: Locator
  readonly saveButton: Locator

  constructor(private readonly page: Page) {
    this.addButton = page.getByRole('button', { name: /add|new cron/i })
    this.rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
    this.nameInput = page.getByLabel(/name/i)
    this.scheduleInput = page.getByLabel(/schedule|cron expression/i)
    this.saveButton = page.getByRole('button', { name: /save|create/i })
  }

  async goto(): Promise<void> { await this.page.goto('/crons') }

  toggleButton(rowIndex: number): Locator {
    return this.rows.nth(rowIndex).getByRole('button', { name: /enable|disable|toggle/i })
  }

  deleteButton(rowIndex: number): Locator {
    return this.rows.nth(rowIndex).getByRole('button', { name: /delete/i })
  }

  runNowButton(rowIndex: number): Locator {
    return this.rows.nth(rowIndex).getByRole('button', { name: /run now/i })
  }
}
