import EventClient from "@/components/event/EventClient.jsx";

export default async function EventPage({ params }) {
  const { slug } = await params;
  return <EventClient slug={slug} />;
}
