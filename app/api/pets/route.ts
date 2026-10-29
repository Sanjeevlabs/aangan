import { z } from "zod";
import { requireCan, requireSession } from "@/lib/auth";
import { dbListMembers } from "@/lib/db";
import { deleteDoc, getDoc, listDocs, newId, putDoc } from "@/lib/family-docs";
import { PET_SPECIES } from "@/lib/kinds";

// Pets are family: they live in a home (with a person), show on the home's
// card and the family map, can have care tasks ("Bruno's vet visit") and a
// birthday or gotcha day. They never have accounts.

const Fields = {
  name: z.string().trim().min(1).max(40),
  species: z.enum(PET_SPECIES),
  livesWith: z.string().min(1),
  photoRef: z.string().max(512).nullable().optional(),
  birthday: z.string().regex(/^(\d{2}-\d{2})?$/).default(""),
  note: z.string().trim().max(160).default(""),
};
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), ...Fields }),
  z.object({ action: z.literal("edit"), petId: z.string().min(1), ...Fields }),
  z.object({ action: z.literal("remove"), petId: z.string().min(1) }),
]);

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  return Response.json({ pets: await listDocs(auth.familyId, "pet") });
}

export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const allowed = await requireCan(auth, "tree.add");
  if (allowed instanceof Response) return allowed;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-pet" }, { status: 400 });
  const body = parsed.data;
  if (body.action === "remove") {
    const pet = await getDoc(auth.familyId, "pet", body.petId);
    if (!pet) return Response.json({ error: "unknown-pet" }, { status: 404 });
    await deleteDoc(auth.familyId, "pet", pet.id);
    return Response.json({ removed: pet.id });
  }
  if (!(await dbListMembers(auth.familyId)).some((m) => m.id === body.livesWith)) return Response.json({ error: "unknown-member" }, { status: 404 });
  const { action, ...fields } = body;
  if (action === "edit") {
    const pet = await getDoc(auth.familyId, "pet", body.petId);
    if (!pet) return Response.json({ error: "unknown-pet" }, { status: 404 });
    const { petId: _p, ...rest } = fields as typeof fields & { petId: string };
    void _p;
    return Response.json({ pet: await putDoc(auth.familyId, "pet", { ...pet, ...rest, photoRef: rest.photoRef ?? pet.photoRef }) });
  }
  const pet = await putDoc(auth.familyId, "pet", { id: newId("pet"), ...fields, photoRef: fields.photoRef ?? null, addedBy: auth.memberId, createdAt: new Date().toISOString() });
  return Response.json({ pet }, { status: 201 });
}
