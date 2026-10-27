import DashboardLayout from "../layouts/DashboardLayout";

function ComingSoon({ title }) {
  return (
    <DashboardLayout title={title}>
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500 text-sm">
        This page isn't built yet.
      </div>
    </DashboardLayout>
  );
}

export default ComingSoon;
