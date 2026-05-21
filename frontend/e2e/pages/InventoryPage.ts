import { type Page, type Locator } from '@playwright/test'

export class InventoryPage {
  readonly searchInput: Locator
  readonly syncButton: Locator
  readonly tableRows: Locator

  constructor(protected readonly page: Page, private readonly path: string) {
    this.searchInput = page.getByPlaceholder(/search/i)
    this.syncButton = page.getByRole('button', { name: /sync/i })
    this.tableRows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
  }

  async goto(): Promise<void> { await this.page.goto(this.path) }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term)
    await this.page.waitForTimeout(400)
  }
}

export class DatabasesPage extends InventoryPage {
  constructor(page: Page) { super(page, '/inventory/databases') }
}

export class KubernetesPage extends InventoryPage {
  constructor(page: Page) { super(page, '/inventory/kubernetes') }
}

export class BlockStoragePage extends InventoryPage {
  constructor(page: Page) { super(page, '/inventory/block-storages') }
}
