// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import CourseIndexPage from "./CourseIndexPage";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("CourseIndexPage", () => {
  beforeEach(() => {
    push.mockReset();
  });

  afterEach(() => {
    setMockBackend(null);
    vi.clearAllMocks();
  });

  it("redirects successful course creation into the new course workspace", async () => {
    setMockBackend({
      listCourses: vi.fn(async () => []),
      createCourse: vi.fn(async () => ({
        id: "course-99",
        instructorId: "instructor-1",
        shortId: "CP-099",
        title: "New Course",
        titleIsPlaceholder: false,
        number: "EDUC 199",
        numberIsPlaceholder: false,
        description: null,
        archivedAt: null,
      })),
    });

    render(<CourseIndexPage />);

    await screen.findByText("No courses yet.");
    fireEvent.click(screen.getByRole("button", { name: "New course" }));
    fireEvent.change(screen.getByLabelText("Course title"), {
      target: { value: "New Course" },
    });
    fireEvent.change(screen.getByLabelText("Course number"), {
      target: { value: "EDUC 199" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create course" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/courses/course-99");
    });
  });
});
