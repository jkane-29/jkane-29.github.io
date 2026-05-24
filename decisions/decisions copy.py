import random

def main():
    # Get number of decision makers
    while True:
        try:
            num_people = int(input("Enter # of decision makers: "))
            if num_people > 0:
                break
            print("Please enter a positive number.")
        except ValueError:
            print("Please enter a valid number.")
    
    # Get number of options
    while True:
        try:
            num_options = int(input("Enter # of options deciding between: "))
            if num_options > 1:
                break
            print("Please enter at least 2 options.")
        except ValueError:
            print("Please enter a valid number.")
    
    # Get option names
    options = []
    print("Enter the name of each option:")
    for i in range(num_options):
        option = input(f"Option {i+1}: ").strip()
        options.append(option)
    
    # Create list of people (Person 1, Person 2, etc.)
    people = [f"Person {i+1}" for i in range(num_people)]
    
    # Shuffle people for random starting order
    random.shuffle(people)
    
    # Start elimination process
    print("\n" + "="*50)
    print("ELIMINATION PROCESS")
    print("="*50)
    print(f"Turn order: {' → '.join(people)}")
    
    round_num = 1
    person_index = 0
    
    while len(options) > 1:
        print(f"\nRound {round_num}")
        print(f"Remaining options: {', '.join(options)}")
        
        # Select current person from rotation
        current_person = people[person_index]
        print(f"\n{current_person}'s turn!")
        print("Choose the option you want to ELIMINATE:")
        
        # Display options with numbers
        for i, option in enumerate(options, 1):
            print(f"  {i}. {option}")
        
        # Get elimination choice
        while True:
            try:
                choice = int(input(f"\nEnter number (1-{len(options)}): "))
                if 1 <= choice <= len(options):
                    break
                print(f"Please enter a number between 1 and {len(options)}.")
            except ValueError:
                print("Please enter a valid number.")
        
        # Remove chosen option
        eliminated = options.pop(choice - 1)
        print(f"\n{eliminated} has been eliminated!")
        
        # Move to next person in rotation
        person_index = (person_index + 1) % num_people
        
        round_num += 1
    
    # Announce winner
    print("\n" + "="*50)
    print("FINAL DECISION")
    print("="*50)
    print(f"\nThe group has chosen: {options[0]}")
    
    # ASCII art celebration
    print("\n" * 2)
    winner_name = options[0][:50]  # Truncate if too long
    trophy_art = """

       .-.,     ,.-.
 '-.  /:::\   //:::\  .-'
 '-.\|':':' `"` ':':'|/.-'
 `-./`. .-=-. .-=-. .`\.-`
   /=- /     |     \ -=\
  ;   |      |      |   ;
  |=-.|______|______|.-=|
  |==  \  0 /_\ 0  /  ==|
  |=   /'---( )---'\   =|
   \   \:   .'.   :/   /
    `\= '--`   `--' =/'
      `-=._     _.=-'
           `"""`
    text_box = f"""
{'═' * 80}
{' ' * 20}╔═══════════════════════════════════════╗
{' ' * 20}║                                       ║
{' ' * 20}║      THE ULTIMATE DECISION            ║
{' ' * 20}║                                       ║
{' ' * 20}║  {winner_name:^35}  ║
{' ' * 20}║                                       ║
{' ' * 20}╚═══════════════════════════════════════╝
{'═' * 80}
"""
    print(trophy_art)
    print(text_box)
    print("="*50)

if __name__ == "__main__":
    main()

    