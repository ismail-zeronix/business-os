import { Pencil, Plus } from "lucide-react";
import { Panel } from "@/components/application/page-canvas";
import { EmptyState, Unknown } from "@/components/application/states";
import { RecordStatusBadge } from "@/components/application/status-badges";
import { TopbarActions } from "@/components/application/topbar-slot";
import { FormDrawer } from "@/components/forms/form-drawer";
import { RecordStatusControl } from "@/components/forms/record-status-control";
import type { SelectOption } from "@/components/forms/multi-select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PREFERRED_CHANNEL_LABEL } from "@/lib/labels";
import { setContactStatusAction } from "../actions";
import type { listContacts } from "../queries";
import { ContactForm } from "./contact-form";

type Contact = Awaited<ReturnType<typeof listContacts>>[number];

function names(items: { brand?: { name: string }; category?: { name: string } }[]) {
  return items.map((i) => i.brand?.name ?? i.category?.name ?? "").filter(Boolean).join(", ");
}

/** A supplier can have many contacts (e.g. Ahmed for Dell laptops, Rashid for servers). Add, edit and archive; nothing is deleted. */
export function ContactsPanel({
  supplierId,
  contacts,
  brandOptions,
  categoryOptions,
  supplierArchived,
}: {
  supplierId: string;
  contacts: Contact[];
  brandOptions: SelectOption[];
  categoryOptions: SelectOption[];
  supplierArchived: boolean;
}) {
  const addButton = (
    <Button size="sm" disabled={supplierArchived} title={supplierArchived ? "Restore the supplier to add contacts" : undefined}>
      <Plus aria-hidden /> Add contact
    </Button>
  );

  return (
    <>
      <TopbarActions>
        <FormDrawer trigger={addButton} title="Add contact" description="Only the name is required.">
          <ContactForm supplierId={supplierId} brandOptions={brandOptions} categoryOptions={categoryOptions} />
        </FormDrawer>
      </TopbarActions>

      <Panel>
        {contacts.length === 0 ? (
          <EmptyState title="No contacts for this supplier" description="Add the people you deal with, for example the person who handles Dell laptops." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Phone / WhatsApp</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Handles</TableHead>
                <TableHead>Preferred</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id} className={contact.status === "ARCHIVED" ? "text-muted-foreground" : undefined}>
                  <TableCell>
                    <span className="block truncate font-medium">{contact.name}</span>
                    {contact.jobTitle || contact.department ? (
                      <span className="block truncate text-xs text-muted-foreground">{[contact.jobTitle, contact.department].filter(Boolean).join(" · ")}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="num">
                    {contact.phone || contact.whatsapp ? (
                      <>
                        <span className="block truncate">{contact.phone ?? "—"}</span>
                        {contact.whatsapp ? <span className="block truncate text-xs text-muted-foreground">WA {contact.whatsapp}</span> : null}
                      </>
                    ) : (
                      <Unknown dash />
                    )}
                  </TableCell>
                  <TableCell className="truncate">{contact.email ?? <Unknown dash />}</TableCell>
                  <TableCell>
                    {contact.brands.length || contact.categories.length ? (
                      <span className="block truncate" title={[names(contact.brands), names(contact.categories)].filter(Boolean).join(" · ")}>
                        {[names(contact.brands), names(contact.categories)].filter(Boolean).join(" · ")}
                      </span>
                    ) : (
                      <Unknown dash />
                    )}
                  </TableCell>
                  <TableCell>{contact.preferredChannel ? PREFERRED_CHANNEL_LABEL[contact.preferredChannel] : <Unknown dash />}</TableCell>
                  <TableCell>
                    <RecordStatusBadge status={contact.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <FormDrawer
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Edit ${contact.name}`} title="Edit">
                            <Pencil aria-hidden />
                          </Button>
                        }
                        title={`Edit ${contact.name}`}
                      >
                        <ContactForm
                          supplierId={supplierId}
                          brandOptions={brandOptions}
                          categoryOptions={categoryOptions}
                          contact={{
                            id: contact.id,
                            name: contact.name,
                            jobTitle: contact.jobTitle,
                            department: contact.department,
                            phone: contact.phone,
                            whatsapp: contact.whatsapp,
                            email: contact.email,
                            preferredChannel: contact.preferredChannel,
                            notes: contact.notes,
                            brandIds: contact.brands.map((b) => b.brand.id),
                            categoryIds: contact.categories.map((c) => c.category.id),
                          }}
                        />
                      </FormDrawer>
                      <RecordStatusControl id={contact.id} status={contact.status} action={setContactStatusAction} entityLabel={contact.name} triggerLabel="Status" size="xs" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
