import { authedTest, expect } from './fixtures/auth'

const VIEWS = [
  { nav: 'Dashboard',      heading: 'Dashboard'        },
  { nav: 'Servers',        heading: 'Server Inventory'  },
  { nav: 'Databases',      heading: 'Databases'         },
  { nav: 'Kubernetes',     heading: 'Kubernetes'        },
  { nav: 'Cloud Providers',heading: 'Cloud Providers'   },
  { nav: 'Sync Logs',      heading: 'Sync Logs'         },
  { nav: 'Cron Jobs',      heading: 'Cron Jobs'         },
  { nav: 'SSH',            heading: 'SSH Credentials'   },
  { nav: 'Settings',       heading: 'Settings'          },
]

authedTest.describe('Navigation', () => {
  for (const { nav, heading } of VIEWS) {
    authedTest(`navigates to ${heading}`, async ({ page }) => {
      // Inventory sub-items need expanding the Inventory group first
      if (['Servers', 'Databases', 'Kubernetes'].includes(nav)) {
        const inventoryBtn = page.getByRole('button', { name: /inventory/i })
        const isOpen = await page.locator('text=Servers').isVisible().catch(() => false)
        if (!isOpen) await inventoryBtn.click()
      }
      await page.getByRole('button', { name: nav }).click()
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 5000 })
    })
  }
})
