"use client";

// The kit's portalled overlays, opened for real: a confirm dialog, a form dialog, a phone
// sheet, the pane's drawer, a menu, a popover and a tooltip. Press Esc, Tab, click the scrim.

import { DotsThree } from "@phosphor-icons/react";
import { useState } from "react";
import { Button, DialogClose, Dialog, Drawer, IconButton, Menu, MenuItem, MenuSeparator, Popover, Sheet, Tooltip, linkClass } from "@/components/kit";

export function LiveOverlays() {
  const [drawer, setDrawer] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-line p-4">
      <p className="w-full text-sm font-medium text-ink">Open the live ones</p>
      <Dialog
        trigger={<Button>Confirm dialog</Button>}
        title="Cancel this RFQ?"
        description="Suppliers who have not quoted see it as cancelled. You can't undo this."
        footer={
          <>
            <DialogClose asChild>
              <Button data-autofocus>Keep RFQ</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button kind="danger">Cancel RFQ</Button>
            </DialogClose>
          </>
        }
      />
      <Dialog
        trigger={<Button>Form dialog</Button>}
        kind="form"
        title="Save search"
        footer={
          <>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button kind="primary">Save search</Button>
          </>
        }
      >
        <p className="text-base text-ink-2">Name it and choose whether to email new matches.</p>
      </Dialog>
      <Sheet
        trigger={<Button>Phone sheet</Button>}
        title="Filters"
        footer={
          <>
            <Button size="touch">Clear all</Button>
            <Button kind="primary" size="touch" className="flex-1">
              Show 4,645 suppliers
            </Button>
          </>
        }
      >
        <p className="py-4 text-md text-ink-2">Rows are 56 tall.</p>
      </Sheet>
      <Button onClick={() => setDrawer(true)}>Drawer</Button>
      <Drawer open={drawer} onOpenChange={setDrawer} title="Aboni Knitwear Ltd." actions={<a href="#" className={linkClass}>Open full page</a>}>
        <p className="px-5 text-base text-ink-2">The pane, as a drawer under 1280.</p>
      </Drawer>
      <Menu trigger={<IconButton icon={DotsThree} label="More actions" />}>
        <MenuItem>Open</MenuItem>
        <MenuItem>Save</MenuItem>
        <MenuItem disabled hint="after an RFQ">
          Message
        </MenuItem>
        <MenuSeparator />
        <MenuItem>Copy link</MenuItem>
      </Menu>
      <Popover trigger={<button type="button" className={linkClass}>From BGMEA · checked 24 Jul 2026</button>}>
        <p className="text-base font-semibold text-ink">BGMEA</p>
        <p className="text-xs text-ink-3">Bangladesh Garment Manufacturers and Exporters Association</p>
      </Popover>
      <Tooltip label="Bangladesh Garment Manufacturers and Exporters Association">
        <button type="button" className={linkClass}>BGMEA</button>
      </Tooltip>
    </div>
  );
}
