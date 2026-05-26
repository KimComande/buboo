import EventClient from "@/components/event/EventClient.jsx";
import { readPublicEvent } from "@/store.js";

export default async function EventPage({ params }) {
  const { slug } = await params;
  const initialEventData = await readPublicEvent(slug);
  return <EventClient slug={slug} initialEventData={initialEventData} />;
}
