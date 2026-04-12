import OpenAI from 'openai';
import { AIQuery, AIQueryConfig } from 'src/utils/shared/AI/AIResource.resource';

export interface ExtractTasksInput {
  content: string;
  currentDate: string;
  history?: { role: string; content: string }[];
}

export interface TaskItem {
  titleOverride: string;
  descriptionOverride: string | null;
  date: string | null;
  beginTimeOverride: string | null;
  endTimeOverride: string | null;
  todos: string[];
  isRepeat: boolean;
  repeatFrequency: string | null;
  repeatEveryNth: number;
  repeatCount: number | null;
}

export interface ExtractTasksOutput {
  message: string;
  tasks: TaskItem[];
}

export class ExtractTasksQuery extends AIQuery<ExtractTasksInput, ExtractTasksOutput> {
  getName() {
    return 'ExtractTasksQuery';
  }

  getConfig(): AIQueryConfig {
    return {
      model: 'gpt-4o-mini',
      max_completion_tokens: 1000,
      temperature: 0.25,
      response_format: { type: 'json_object' },
    };
  }

  async buildMessages(input: ExtractTasksInput): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const mappedHistory = (input.history || []).map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

    return [
      {
        role: 'system',
        content: `You are an AI event organizer. TODAY is ${input.currentDate}.

        Extract schedule items and events from the user's input.
        Return a JSON object exactly matching this structure:
        {
          "message": "2-3 sentence reply in Polish summarizing what you extracted and why — e.g. which events were added, what times were inferred and why. If you could not extract anything useful, say exactly: 'Potrzebuję więcej szczegółów — podaj nazwę wydarzenia, datę lub godzinę, żebym mógł coś dodać.'",
          "tasks": [
            {
              "titleOverride": "string (in Polish)",
              "descriptionOverride": "string or null",
              "date": "YYYY-MM-DD or null",
              "beginTimeOverride": "HH:MM or null",
              "endTimeOverride": "HH:MM or null",
              "todos": ["todo item 1", "todo item 2"],
              "isRepeat": false,
              "repeatFrequency": "daily|weekly|monthly or null",
              "repeatEveryNth": 1,
              "repeatCount": null
            }
          ]
        }

        Date resolution logic (return strict YYYY-MM-DD):
        - "jutro" / "tomorrow" = next day
        - "pojutrze" = +2 days
        - "za tydzień" / "next week" = +7 days
        - Day of week (e.g. "w poniedziałek") = next upcoming occurrence.

        Time inference — infer beginTimeOverride and endTimeOverride from context when not explicitly given:
        - Work / praca / spotkanie / meeting / biuro → 08:00–16:00
        - Rano / morning → 07:00–12:00
        - Po południu / afternoon / popołudnie → 12:00–17:00
        - Wieczór / wieczorem / evening → 19:00–22:00
        - Noc / night → 22:00–00:00
        - Lunch / obiad → 12:00–13:00
        - Gym / siłownia / trening / workout → 07:00–08:30
        - If no time context at all, leave both as null.
        - Always infer a reasonable endTimeOverride based on the event type/duration if begin is known.

        Recurring logic:
        - Set isRepeat=true if the user implies the event repeats (e.g. "every day", "co tydzień", "daily", "weekly").
        - Set repeatFrequency to "daily", "weekly", or "monthly" accordingly.
        - repeatEveryNth = interval (e.g. "every 2 weeks" → repeatEveryNth=2, repeatFrequency="weekly").
        - repeatCount = number of total occurrences if mentioned, otherwise null.

        Todos — IMPORTANT, bias towards using todos:
        - Whenever the user mentions 2 or more distinct actions/items within the same context (same place, same time, same event), create ONE event for that context and put each action as a separate todo item. Do NOT create separate events for each action.
        - Example: "w pracy muszę zrobić X oraz Y" → one event "Praca" with todos: ["X", "Y"]
        - Example: "na siłowni: klatka i nogi" → one event "Trening" with todos: ["Klatka", "Nogi"]
        - Example: "jutro ogarnę zakupy: mleko, chleb, jajka" → one event "Zakupy" with todos: ["Mleko", "Chleb", "Jajka"]
        - Only create multiple separate events when the user clearly describes things at different times/places/days.
        - If the user lists any subtasks, checklist items, or multiple things to do in one place — always put them in todos.
        - If nothing fits as todos, return an empty array [].

        If the input is too vague to extract any event (no name, no date, no actionable info), return tasks=[] and explain in message what is missing.

        DO NOT return events that are clearly in the past relative to currentDate.
        DO NOT return an event already mentioned in the history unless the user explicitly refers to it again with intention to edit it.

        Leave fields as JSON null if not explicitly mentioned and cannot be reasonably inferred.`,
      },
      ...mappedHistory,
      {
        role: 'user',
        content: input.content,
      },
    ];
  }
}
