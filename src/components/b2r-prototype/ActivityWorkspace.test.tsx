// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildFixture, getDuplicateTopicActions } from "@/lib/b2r-prototype-fixture";
import DuplicateWarning from "./DuplicateWarning";
import CourseHeader from "./CourseHeader";
import LMBoard from "./LMBoard";
import ModeToggle from "./ModeToggle";
import RunViewport from "./RunViewport";
import TopicBank from "./TopicBank";
import ActivityWorkspacePage from "@/app/prototypes/activity-workspace/page";

describe("mode toggle", () => {
  it("renders design and run buttons", () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="design" onChange={onChange} />);
    expect(screen.getByRole("button", { name: /design/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /run/i })).toBeTruthy();
  });

  it("marks design as pressed when mode=design", () => {
    render(<ModeToggle mode="design" onChange={vi.fn()} />);
    const designBtn = screen.getByRole("button", { name: /design/i });
    expect(designBtn.getAttribute("aria-pressed")).toBe("true");
    const runBtn = screen.getByRole("button", { name: /run/i });
    expect(runBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onChange with 'run' when run button clicked", () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="design" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(onChange).toHaveBeenCalledWith("run");
  });

  it("calls onChange with 'design' when design button clicked from run mode", () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="run" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /design/i }));
    expect(onChange).toHaveBeenCalledWith("design");
  });
});

describe("LMBoard — duplicate warnings", () => {
  const fixture = buildFixture();
  const dupeMap = getDuplicateTopicActions(fixture.topicActions);
  const dupeIds = new Set([...dupeMap.values()].flat().map((ta) => ta.id));

  function renderBoard(selectedId: string | null = null) {
    return render(
      <LMBoard
        learningModules={fixture.learningModules}
        activities={fixture.activities}
        activityTypes={fixture.activityTypes}
        topicActions={fixture.topicActions}
        topics={fixture.topics}
        selectedActivityId={selectedId}
        duplicateTopicActionIds={dupeIds}
        searchQuery=""
        onRegisterCardRef={vi.fn()}
        onSelectActivity={vi.fn()}
        onMoveActivity={vi.fn()}
      />,
    );
  }

  it("renders LM columns", () => {
    renderBoard();
    // At least one column visible (unassigned always present)
    expect(screen.getAllByRole("article").length).toBeGreaterThan(0);
  });

  it("marks cards with duplicate topic actions with amber dot", () => {
    renderBoard();
    // The amber indicator uses aria-label="Contains duplicate topic actions"
    const indicators = document.querySelectorAll('[aria-label="Contains duplicate topic actions"]');
    expect(indicators.length).toBeGreaterThan(0);
  });
});

describe("LMBoard — card ref registration", () => {
  const fixture = buildFixture();
  const dupeMap = getDuplicateTopicActions(fixture.topicActions);
  const dupeIds = new Set([...dupeMap.values()].flat().map((ta) => ta.id));

  it("registers mounted cards with their activity id and unregisters on unmount", () => {
    const onRegisterCardRef = vi.fn();
    const { unmount } = render(
      <LMBoard
        learningModules={fixture.learningModules}
        activities={fixture.activities}
        activityTypes={fixture.activityTypes}
        topicActions={fixture.topicActions}
        topics={fixture.topics}
        selectedActivityId={null}
        duplicateTopicActionIds={dupeIds}
        searchQuery=""
        onRegisterCardRef={onRegisterCardRef}
        onSelectActivity={vi.fn()}
        onMoveActivity={vi.fn()}
      />,
    );

    expect(onRegisterCardRef).toHaveBeenCalled();
    expect(onRegisterCardRef).toHaveBeenCalledWith(expect.any(String), expect.any(HTMLElement));

    const firstCall = onRegisterCardRef.mock.calls[0];
    const firstActivityId = firstCall[0] as string;
    const firstElement = firstCall[1] as HTMLElement;
    expect(firstElement).toBeInstanceOf(HTMLElement);

    unmount();

    expect(onRegisterCardRef).toHaveBeenCalledWith(firstActivityId, null);
  });
});

describe("TopicBank", () => {
  const topics = [
    {
      id: "topic-1",
      title: "Regression Basics",
      code: "RB",
      category: "Modeling & Regression",
    },
  ];

  function renderBank(selectedActivityTitle: string | null, onAddAction = vi.fn()) {
    return render(
      <TopicBank
        topics={topics}
        onAddAction={onAddAction}
        searchQuery=""
        selectedActivityTitle={selectedActivityTitle}
      />,
    );
  }

  it("explains that an activity must be selected and disables I/P/A buttons", () => {
    renderBank(null);

    expect(screen.getByTestId("topic-bank-no-target").textContent).toMatch(
      /select a meeting or coursework item before attaching topics/i,
    );

    fireEvent.click(screen.getByRole("button", { name: /modeling & regression/i }));

    const addButton = screen.getByRole("button", { name: /introduce regression basics/i }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
  });

  it("shows the selected activity title and enables I/P/A buttons", () => {
    const onAddAction = vi.fn();
    renderBank("Lecture 3: Regression Review", onAddAction);

    expect(screen.getByTestId("topic-bank-target").textContent).toMatch(
      /adding to lecture 3: regression review/i,
    );

    fireEvent.click(screen.getByRole("button", { name: /modeling & regression/i }));

    const addButton = screen.getByRole("button", { name: /introduce regression basics/i }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);

    fireEvent.click(addButton);
    expect(onAddAction).toHaveBeenCalledWith("topic-1", "I");
  });
});

describe("DuplicateWarning", () => {
  it("shows total count, only other occurrences, human titles, and navigates to the clicked activity", () => {
    const onNavigate = vi.fn();
    const activityTitleById = new Map([
      ["lec01", "Lecture 1"],
      ["lab02", "Lab 2"],
      ["lec03", "Lecture 3"],
    ]);

    render(
      <DuplicateWarning
        topicTitle="Regression Basics"
        action="I"
        totalActivities={3}
        otherOccurrences={[
          { id: "ta-2", activityId: "lab02", topicId: "topic-1", action: "I" },
          { id: "ta-3", activityId: "lec03", topicId: "topic-1", action: "I" },
        ]}
        activityTitleById={activityTitleById}
        onNavigate={onNavigate}
      />,
    );

    expect(screen.getByText(/regression basics/i)).toBeTruthy();
    expect(screen.getByText(/in 3 activities/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lab 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lecture 3" })).toBeTruthy();
    expect(screen.queryByText("lec01")).toBeNull();
    expect(screen.queryByRole("button", { name: "Lecture 1" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Lab 2" }));
    expect(onNavigate).toHaveBeenCalledWith("lab02");
  });
});

describe("RunViewport — next work visibility", () => {
  const fixture = buildFixture();

  it("shows current module section", () => {
    render(<RunViewport fixture={fixture} />);
    expect(screen.getByText(/current module/i)).toBeTruthy();
  });

  it("shows next meeting section", () => {
    render(<RunViewport fixture={fixture} />);
    expect(screen.getByText("Next meeting")).toBeTruthy();
  });

  it("shows active topics section", () => {
    render(<RunViewport fixture={fixture} />);
    expect(screen.getByText(/active topics/i)).toBeTruthy();
  });

  it("shows upcoming sequence list", () => {
    render(<RunViewport fixture={fixture} />);
    const section = screen.getByLabelText("Upcoming sequence");
    expect(section.querySelector("ol")).toBeTruthy();
  });

  it("shows next milestone section", () => {
    render(<RunViewport fixture={fixture} />);
    expect(screen.getByText(/next milestone/i)).toBeTruthy();
  });

  it("shows prepare for next meeting section", () => {
    render(<RunViewport fixture={fixture} />);
    expect(screen.getByText(/prepare for next meeting/i)).toBeTruthy();
  });

  it("shows term exceptions when present", () => {
    render(<RunViewport fixture={fixture} />);
    // The fixture has 3 term exceptions
    expect(screen.getByText(/term exceptions/i)).toBeTruthy();
  });

  it("shows finals period notice when finals are within 60 days", () => {
    render(<RunViewport fixture={fixture} />);
    // currentDate = 2026-04-15; finals start ~May 2026 — within 60 days
    expect(screen.getByText(/finals/i)).toBeTruthy();
  });
});

describe("CourseHeader tool actions", () => {
  function renderHeader() {
    const onSearch = vi.fn();
    const onModeChange = vi.fn();
    const onOpenTopics = vi.fn();
    const onOpenActivityTypes = vi.fn();
    const onOpenCalendar = vi.fn();

    render(
      <CourseHeader
        courseTitle="Data Science 100"
        courseCode="DS 100"
        termLabel="Spring 2026"
        mode="design"
        onModeChange={onModeChange}
        onSearch={onSearch}
        onOpenTopics={onOpenTopics}
        onOpenActivityTypes={onOpenActivityTypes}
        onOpenCalendar={onOpenCalendar}
        searchQuery=""
      />,
    );

    return { onOpenTopics, onOpenActivityTypes, onOpenCalendar };
  }

  it("opens the topics tool", () => {
    const { onOpenTopics } = renderHeader();
    fireEvent.click(screen.getByRole("button", { name: /^Topics$/i }));
    expect(onOpenTopics).toHaveBeenCalledTimes(1);
  });

  it("opens the activity types tool", () => {
    const { onOpenActivityTypes } = renderHeader();
    fireEvent.click(screen.getByRole("button", { name: /^Activity types$/i }));
    expect(onOpenActivityTypes).toHaveBeenCalledTimes(1);
  });

  it("opens the calendar tool", () => {
    const { onOpenCalendar } = renderHeader();
    fireEvent.click(screen.getByRole("button", { name: /^Calendar$/i }));
    expect(onOpenCalendar).toHaveBeenCalledTimes(1);
  });
});

describe("ActivityWorkspacePage milestones", () => {
  it("exposes the milestone editor for projects and persists one add/remove cycle", () => {
    render(<ActivityWorkspacePage />);

    const projectCard = screen.getByRole("article", { name: /predictive model/i });
    fireEvent.click(within(projectCard).getAllByRole("button", { name: /predictive model/i })[0]);

    expect(screen.getByRole("button", { name: /add milestone/i })).toBeTruthy();
    expect(screen.getByText("4 milestones")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Milestone role/i), { target: { value: "due" } });
    fireEvent.change(screen.getByLabelText(/Milestone label/i), { target: { value: "Draft packet" } });
    fireEvent.change(screen.getByLabelText(/^Meeting$/i), { target: { value: "lec11" } });
    fireEvent.click(screen.getByRole("button", { name: /add milestone/i }));

    expect(screen.getByText("5 milestones")).toBeTruthy();
    expect(screen.getByRole("button", { name: /remove due milestone draft packet/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /remove due milestone draft packet/i }));

    expect(screen.queryByRole("button", { name: /remove due milestone draft packet/i })).toBeNull();
    expect(screen.getByText("4 milestones")).toBeTruthy();
  });
});
