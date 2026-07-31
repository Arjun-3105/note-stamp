import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { createUser, getUser, updateUser } from '@/lib/db/users';

export async function POST(req: Request) {
  const headersList = await headers();
  const svixId = headersList.get('svix-id');
  const svixTimestamp = headersList.get('svix-timestamp');
  const svixSignature = headersList.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Unauthorized', { status: 401 });
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || '');
  let evt;

  try {
    evt = wh.verify(await req.text(), {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as any;
  } catch (err) {
    console.error('Webhook verification failed', err);
    return new Response('Unauthorized', { status: 401 });
  }

  const eventType = evt.type;

  try {
    if (eventType === 'user.created') {
      const { id, email_addresses } = evt.data;
      const email = email_addresses[0]?.email_address || '';

      const existingUser = await getUser(id);
      if (!existingUser) {
        await createUser({
          userId: id,
          email,
        });
      }
    } else if (eventType === 'user.updated') {
      const { id, email_addresses } = evt.data;
      const email = email_addresses[0]?.email_address || '';

      const user = await getUser(id);
      if (user) {
        await updateUser(id, { email } as any);
      }
    }

    return new Response('Webhook processed', { status: 200 });
  } catch (err) {
    console.error('Error processing webhook', err);
    return new Response('Error processing webhook', { status: 500 });
  }
}

