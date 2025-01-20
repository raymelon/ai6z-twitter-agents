from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.tools import tool
import subprocess

# If you want to run a snippet of code before or after the crew starts,
# you can use the @before_kickoff and @after_kickoff decorators
# https://docs.crewai.com/concepts/crews#example-crew-class-with-decorators


@tool("Unfollower Tracker")
def unfollower_tracker_tool(username: str) -> str:
    """Tracks unfollowers for a Twitter user."""
    # Tool logic here

    print(username)
    print("Unfollower Tracker tool started")

    node_script_path = '../twitter-clients/unfollower-client/run-function-only.js'

    try:
        # Run the Node.js script and capture both stdout and stderr
        result = subprocess.run(
            ['node', node_script_path], capture_output=True, text=True)

        # Check for any errors
        result.check_returncode()

        # Print the output from the Node.js script
        print("STDOUT:", result.stdout)
        print("STDERR:", result.stderr)

    except subprocess.CalledProcessError as e:
        print(f"Script failed with return code {e.returncode}")
        print("STDERR:", e.stderr)

    print("Unfollower Tracker tool finished")

    return f"Tool output: {username}"


@CrewBase
class CrewaiAgent():
    """CrewaiAgent crew"""

    # Learn more about YAML configuration files here:
    # Agents: https://docs.crewai.com/concepts/agents#yaml-configuration-recommended
    # Tasks: https://docs.crewai.com/concepts/tasks#yaml-configuration-recommended
    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    # If you would like to add tools to your agents, you can learn more about it here:
    # https://docs.crewai.com/concepts/agents#agent-tools
    @agent
    def follower_fetcher(self) -> Agent:
        return Agent(
            config=self.agents_config['follower_fetcher'],
            verbose=True,
            tools=[unfollower_tracker_tool]
        )

    # To learn more about structured task outputs,
    # task dependencies, and task callbacks, check out the documentation:
    # https://docs.crewai.com/concepts/tasks#overview-of-a-task
    @task
    def follower_fetcher_task(self) -> Task:
        return Task(
            config=self.tasks_config['follower_fetcher_task'],
        )

    @crew
    def crew(self) -> Crew:
        """Creates the CrewaiAgent crew"""
        # To learn how to add knowledge sources to your crew, check out the documentation:
        # https://docs.crewai.com/concepts/knowledge#what-is-knowledge

        return Crew(
            agents=self.agents,  # Automatically created by the @agent decorator
            tasks=self.tasks,  # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
            # process=Process.hierarchical, # In case you wanna use that instead https://docs.crewai.com/how-to/Hierarchical/
        )
