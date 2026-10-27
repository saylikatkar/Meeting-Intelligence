import DashboardLayout from "../../layouts/DashboardLayout";
import ActionList from "../../components/ActionList";

function ActionItems() {
  return (
    <DashboardLayout title="Action Items">
      <ActionList
        heading={{
          eyebrow: "FOLLOW-UPS",
          title: "Action items",
          subtitle: "Track tasks, owners, priorities, meeting sources and due dates.",
        }}
      />
    </DashboardLayout>
  );
}

export default ActionItems;
